import { bookings, createDatabase, defaultPricingRules, events, type Database } from "@repo/database";
import request from "supertest";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./createApp.js";

const url = process.env.DATABASE_URL;
const runDbTests = process.env.RUN_DB_TESTS === "true";
const ROW_TAG = "__vitest_booking_flow__";

if (runDbTests && !url) {
  throw new Error("RUN_DB_TESTS=true but DATABASE_URL is missing for booking flow tests.");
}

describe.skipIf(!url || !runDbTests)("Booking flow integration", () => {
  let shutdownDb!: () => Promise<void>;
  let db!: Database;
  let eventId!: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    process.env.ADMIN_API_KEY ??= "test-admin";

    const pool = createDatabase(url!);
    db = pool.db;
    shutdownDb = pool.close.bind(pool);

    const prior = await db.select({ id: events.id }).from(events).where(eq(events.description, ROW_TAG));
    for (const p of prior) {
      await db.delete(bookings).where(eq(bookings.eventId, p.id));
    }
    await db.delete(events).where(eq(events.description, ROW_TAG));

    const inserted = await db
      .insert(events)
      .values({
        name: "Booking flow lab",
        eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        venue: "Integration Arena",
        description: ROW_TAG,
        totalTickets: 20,
        bookedTickets: 0,
        basePriceCents: 4_500,
        currentPriceCents: 4_500,
        floorPriceCents: 3_000,
        ceilingPriceCents: 8_000,
        pricingRules: defaultPricingRules(),
      })
      .returning({ id: events.id });

    const row = inserted[0];
    if (!row) throw new Error("Failed to seed booking flow event");
    eventId = row.id;
    app = createApp(db, { time: 1, demand: 1, inventory: 1 });
  });

  afterAll(async () => {
    if (!db || !eventId) return;
    await db.delete(bookings).where(eq(bookings.eventId, eventId));
    await db.delete(events).where(eq(events.id, eventId));
    await shutdownDb();
  });

  it("returns deterministic pricing details and stores booking snapshots", async () => {
    const detail = await request(app).get(`/events/${eventId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.event.id).toBe(eventId);
    expect(detail.body.event.breakdown).toBeDefined();

    const reserve = await request(app)
      .post("/bookings")
      .send({ eventId, userEmail: "flow@test.dev", quantity: 2 });
    expect(reserve.status).toBe(201);
    expect(reserve.body.booking.eventId).toBe(eventId);
    expect(reserve.body.booking.quantity).toBe(2);
    expect(reserve.body.booking.unitPricePaid.cents).toBeGreaterThan(0);
    expect(reserve.body.booking.totalPaid.cents).toBe(
      reserve.body.booking.quantity * reserve.body.booking.unitPricePaid.cents,
    );

    const byEmail = await request(app).get("/bookings").query({ email: "flow@test.dev" });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.bookings).toHaveLength(1);
    expect(byEmail.body.bookings[0].eventId).toBe(eventId);
    expect(byEmail.body.bookings[0].ownerEmail).toBe("flow@test.dev");
    expect(byEmail.body.bookings[0].totalPaid.cents).toBe(reserve.body.booking.totalPaid.cents);
  });
});
