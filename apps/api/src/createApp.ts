import { runSeed, bookings, events, defaultPricingRules, type EventRow } from "@repo/database";
import type { PricingBreakdown, PricingRulesConfig, PricingWeights } from "@repo/pricing";
import { and, eq } from "drizzle-orm";
import cors from "cors";
import express from "express";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

import type { DbClient } from "./db.js";
import { adminApiKey, pricingWeightsFromEnv } from "./env.js";
import {
  eventAggregates,
  listUpcomingEventIds,
  priceEventRow,
} from "./pricingForEvent.js";
import { simClock } from "./simClock.js";

const asyncRoute =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const maybe = error as { message?: unknown; code?: unknown };
    if (typeof maybe.message === "string" && maybe.message) return maybe.message;
    if (typeof maybe.code === "string" && maybe.code) return `code=${maybe.code}`;
    try {
      return JSON.stringify(error);
    } catch {
      return "unknown error";
    }
  }
  return "unknown error";
}

function formatMoney(cents: number) {
  return {
    cents,
    formatted: `$${(cents / 100).toFixed(2)}`,
  };
}

const adminGate: RequestHandler = (req, res, next) => {
  const expected = adminApiKey();
  if (!expected) {
    res.status(503).json({ error: "ADMIN_API_KEY is not configured" });
    return;
  }
  const got = req.header("x-admin-api-key") ?? "";
  if (got !== expected) {
    res.status(401).json({ error: "Invalid admin credential" });
    return;
  }
  next();
};

function breakdownPayload(
  evt: Pick<EventRow, "basePriceCents">,
  b: PricingBreakdown,
  weights: PricingWeights,
) {
  return {
    weights,
    weightedSum: b.weightedSum,
    adjustments: {
      time: b.adjustments.time,
      demand: b.adjustments.demand,
      inventory: b.adjustments.inventory,
      weighted: {
        time: weights.time * b.adjustments.time,
        demand: weights.demand * b.adjustments.demand,
        inventory: weights.inventory * b.adjustments.inventory,
      },
    },
    computation: `${evt.basePriceCents}c × (1 + ${b.weightedSum.toFixed(4)})`,
  };
}

const createBody = z.object({
  name: z.string().min(1),
  eventDate: z.string().datetime({ offset: true }),
  venue: z.string().min(1),
  description: z.string().optional().default(""),
  totalTickets: z.number().int().positive(),
  basePriceCents: z.number().int().positive(),
  floorPriceCents: z.number().int().positive(),
  ceilingPriceCents: z.number().int().positive(),
  pricingRules: z.any().optional(),
}).superRefine((payload, ctx) => {
  if (payload.floorPriceCents > payload.ceilingPriceCents) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "floorPriceCents must be less than or equal to ceilingPriceCents",
      path: ["floorPriceCents"],
    });
  }
  if (
    payload.basePriceCents < payload.floorPriceCents ||
    payload.basePriceCents > payload.ceilingPriceCents
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "basePriceCents must be within floor/ceiling bounds",
      path: ["basePriceCents"],
    });
  }
});

const bookingBody = z.object({
  eventId: z.string().uuid(),
  userEmail: z.string().email(),
  quantity: z.number().int().positive(),
});

const simPutBody = z.object({
  /** Human-friendly speed presets for reviewer flows. */
  preset: z.enum(["pause", "realtime", "x2", "x5", "x10"]),
});

const simAlignWindowBody = z.object({
  eventId: z.string().uuid(),
  window: z.enum(["base", "week", "tomorrow", "start"]),
});

function daysUntilForWindow(window: "base" | "week" | "tomorrow" | "start"): number {
  if (window === "base") return 30;
  if (window === "week") return 7;
  if (window === "tomorrow") return 1;
  return 0;
}

export function createApp(db: DbClient, weights: PricingWeights) {
  const app: Express = express();
  app.use(
    cors({
      origin: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
      ],
    }),
  );
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      service: "ticketing-api",
      status: "ok",
      docsHint:
        "Use /events, /bookings, /analytics/summary, /analytics/events/:id, /dev/sim-time, and /dev/sim-time/align-window (when enabled).",
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  /** Dev-only ergonomic aid - never enabled in unattended production demos without explicit intent. */
  app.get("/dev/sim-time", (_req, res) => {
    if (!simClock.isEnabled()) return res.status(404).json({ error: "Not enabled" });
    res.json(simClock.snapshot());
  });

  app.put("/dev/sim-time", (req, res) => {
    if (!simClock.isEnabled()) return res.status(404).json({ error: "Not enabled" });
    const parsed = simPutBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { preset } = parsed.data;
    if (preset === "pause") simClock.setRate(0);
    else if (preset === "realtime") simClock.reset();
    else if (preset === "x2") simClock.setRate(2);
    else if (preset === "x5") simClock.setRate(5);
    else if (preset === "x10") simClock.setRate(10);
    res.json(simClock.snapshot());
  });

  app.post("/dev/sim-time/align-window", asyncRoute(async (req, res) => {
    if (!simClock.isEnabled()) return res.status(404).json({ error: "Not enabled" });
    const parsed = simAlignWindowBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { eventId, window } = parsed.data;
    const [evt] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!evt) return res.status(404).json({ error: "Event not found" });

    const daysUntilEvent = daysUntilForWindow(window);
    const targetNowMs = evt.eventDate.getTime() - daysUntilEvent * 24 * 60 * 60 * 1000;
    simClock.setNowMs(targetNowMs);
    const pricing = await priceEventRow(db, evt, weights);

    res.json({
      ...simClock.snapshot(),
      alignedTo: {
        eventId: evt.id,
        eventName: evt.name,
        window,
        daysUntilEvent,
      },
      expectedRuleState: {
        timeAdjustment: pricing.adjustments.time,
        weightedTimeAdjustment: weights.time * pricing.adjustments.time,
      },
    });
  }));

  app.get("/events", asyncRoute(async (_req, res) => {
    const ids = await listUpcomingEventIds(db);
    const rows: Array<unknown> = [];
    for (const { id } of ids) {
      const [evt] = await db.select().from(events).where(eq(events.id, id)).limit(1);
      if (!evt) continue;
      const pricing = await priceEventRow(db, evt, weights);
      rows.push({
        id: evt.id,
        name: evt.name,
        date: evt.eventDate.toISOString(),
        venue: evt.venue,
        currentPrice: formatMoney(pricing.unitPriceCents),
        availability: evt.totalTickets - evt.bookedTickets,
      });
      await db
        .update(events)
        .set({ currentPriceCents: pricing.unitPriceCents })
        .where(eq(events.id, evt.id));
    }
    res.json({ events: rows });
  }));

  app.get("/events/:id", asyncRoute(async (req, res) => {
    const id = req.params.id!;
    const [evt] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    const pricing = await priceEventRow(db, evt, weights);
    res.json({
      event: {
        id: evt.id,
        name: evt.name,
        date: evt.eventDate.toISOString(),
        venue: evt.venue,
        description: evt.description,
        capacity: evt.totalTickets,
        bookedTickets: evt.bookedTickets,
        remaining: evt.totalTickets - evt.bookedTickets,
        basePrice: formatMoney(evt.basePriceCents),
        currentPrice: formatMoney(pricing.unitPriceCents),
        floorPrice: formatMoney(evt.floorPriceCents),
        ceilingPrice: formatMoney(evt.ceilingPriceCents),
        breakdown: breakdownPayload(evt, pricing, weights),
      },
      simTime: simClock.isEnabled() ? simClock.snapshot() : null,
    });
  }));

  app.post("/events", adminGate, asyncRoute(async (req, res) => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const payload = parsed.data;
    const rules = (payload.pricingRules as PricingRulesConfig | undefined) ?? defaultPricingRules();
    const [created] = await db
      .insert(events)
      .values({
        name: payload.name,
        venue: payload.venue,
        description: payload.description,
        eventDate: new Date(payload.eventDate),
        totalTickets: payload.totalTickets,
        bookedTickets: 0,
        basePriceCents: payload.basePriceCents,
        currentPriceCents: payload.basePriceCents,
        floorPriceCents: payload.floorPriceCents,
        ceilingPriceCents: payload.ceilingPriceCents,
        pricingRules: rules,
      })
      .returning();
    if (!created) return res.status(500).json({ error: "Failed to persist event" });
    res.status(201).json({
      event: {
        ...created,
        eventDate: created.eventDate.toISOString(),
      },
    });
  }));

  app.get("/bookings", asyncRoute(async (req, res) => {
    const eventId = z.string().uuid().safeParse(req.query.eventId);
    const email = z.string().email().safeParse(req.query.email);
    if (!eventId.success && !email.success)
      return res.status(400).json({ error: "Provide query eventId=<uuid> and/or email=<address>" });

    let rows;
    if (eventId.success && email.success) {
      rows = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.eventId, eventId.data), eq(bookings.userEmail, email.data)));
    } else if (eventId.success) {
      rows = await db.select().from(bookings).where(eq(bookings.eventId, eventId.data));
    } else if (email.success) {
      rows = await db.select().from(bookings).where(eq(bookings.userEmail, email.data));
    }
    const payloads = [];
    for (const b of rows ?? []) {
      const [evtRow] = await db.select({ name: events.name }).from(events).where(eq(events.id, b.eventId)).limit(1);
      payloads.push({
        id: b.id,
        quantity: b.quantity,
        unitPricePaid: formatMoney(b.unitPriceCentsSnapshot),
        totalPaid: formatMoney(b.totalPaidCents),
        ownerEmail: b.userEmail,
        eventId: b.eventId,
        eventName: evtRow?.name ?? "Unknown event",
        createdAt: b.createdAt.toISOString(),
      });
    }
    res.json({ bookings: payloads });
  }));

  app.post("/bookings", asyncRoute(async (req, res) => {
    const parsed = bookingBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { eventId, userEmail, quantity } = parsed.data;
    try {
      const result = await db.transaction(async (tx) => {
        const [evt] = await tx
          .select()
          .from(events)
          .where(eq(events.id, eventId))
          .for("update")
          .limit(1);

        if (!evt) throw new Error("MISSING_EVENT");
        if (evt.eventDate.getTime() <= simClock.nowMs()) throw new Error("EVENT_STARTED");
        if (evt.bookedTickets + quantity > evt.totalTickets) throw new Error("OVERBOOK");

        const pricing = await priceEventRow(tx as unknown as DbClient, evt, weights);
        const contextMs = simClock.nowMs();
        const totals = quantity * pricing.unitPriceCents;
        await tx.insert(bookings).values({
          eventId: evt.id,
          userEmail,
          quantity,
          unitPriceCentsSnapshot: pricing.unitPriceCents,
          totalPaidCents: totals,
          pricingContextMs: contextMs,
        });
        const newBooked = evt.bookedTickets + quantity;
        await tx
          .update(events)
          .set({
            bookedTickets: newBooked,
            currentPriceCents: pricing.unitPriceCents,
            updatedAt: new Date(),
          })
          .where(eq(events.id, evt.id));

        return { evt, pricing, totals, quantity, contextMs };
      });

      res.status(201).json({
        booking: {
          eventId,
          quantity: result.quantity,
          unitPricePaid: formatMoney(result.pricing.unitPriceCents),
          totalPaid: formatMoney(result.totals),
          userEmail,
          simulatedClockMs: simClock.isEnabled() ? simClock.snapshot().simulatedNowMs : undefined,
          breakdown: breakdownPayload(result.evt, result.pricing, weights),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "OVERBOOK") return res.status(409).json({ error: "Not enough tickets left" });
      if (msg === "MISSING_EVENT") return res.status(404).json({ error: "Event not found" });
      if (msg === "EVENT_STARTED")
        return res.status(409).json({ error: "Booking closed because the event has already started" });
      throw e;
    }
  }));

  app.get("/analytics/events/:id", asyncRoute(async (req, res) => {
    const id = req.params.id!;
    const [evt] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    if (!evt) return res.status(404).json({ error: "Event not found" });
    const pricing = await priceEventRow(db, evt, weights);
    const agg = await eventAggregates(db, id);
    res.json({
      eventId: id,
      totalSold: agg.sold,
      revenue: formatMoney(agg.revenue),
      averageUnitPricePaid: formatMoney(agg.avgUnit),
      currentDynamicPrice: formatMoney(pricing.unitPriceCents),
      remaining: evt.totalTickets - evt.bookedTickets,
    });
  }));

  app.get("/analytics/summary", asyncRoute(async (_req, res) => {
    const all = await db.select().from(events);
    let revenue = 0;
    let sold = 0;
    for (const e of all) {
      const agg = await eventAggregates(db, e.id);
      revenue += agg.revenue;
      sold += agg.sold;
    }
    res.json({
      events: all.length,
      ticketsSold: sold,
      revenue: formatMoney(revenue),
    });
  }));

  app.post("/seed", adminGate, asyncRoute(async (_req, res) => {
    const count = await runSeed(db);
    res.json({
      seededEvents: count,
      message:
        count > 0
          ? "Sample rows inserted - safe to rerun to reset dashboards between reviewer attempts."
          : "Nothing seeded",
    });
  }));

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    void next;
    const message = errorText(error);
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    const codeText = typeof code === "string" ? code : "";

    if ((message.includes("ECONNREFUSED") && message.includes("5432")) || codeText === "ECONNREFUSED") {
      res.status(503).json({
        error:
          "Database is unreachable on port 5432. Start Postgres or update DATABASE_URL.",
      });
      return;
    }
    if (codeText === "42P01") {
      res.status(503).json({
        error:
          "Database schema is missing. Run `pnpm --filter @repo/database db:push` then `pnpm --filter @repo/database db:seed`.",
      });
      return;
    }
    res.status(500).json({ error: "Internal server error", detail: message || "unknown error" });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

export function createDefaultApp(db: DbClient) {
  return createApp(db, pricingWeightsFromEnv());
}
