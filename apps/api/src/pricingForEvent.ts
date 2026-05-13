import type { PricingBreakdown, PricingWeights } from "@repo/pricing";
import { computeTicketPrice } from "@repo/pricing";
import { bookings, events, type EventRow } from "@repo/database";
import { and, asc, count, eq, gt, gte } from "drizzle-orm";

import type { DbClient } from "./db.js";
import { simClock } from "./simClock.js";

export async function countBookingsLastHour(db: DbClient, eventId: string, contextNowMs: number) {
  const windowStartMs = contextNowMs - 60 * 60 * 1000;
  const [row] = await db
    .select({ cnt: count() })
    .from(bookings)
    .where(and(eq(bookings.eventId, eventId), gte(bookings.pricingContextMs, windowStartMs)));
  return Number(row?.cnt ?? 0);
}

export async function priceEventRow(
  db: DbClient,
  evt: EventRow,
  weights: PricingWeights,
): Promise<PricingBreakdown> {
  const nowMs = simClock.nowMs();
  const hourly = await countBookingsLastHour(db, evt.id, nowMs);
  return computeTicketPrice({
    basePriceCents: evt.basePriceCents,
    floorPriceCents: evt.floorPriceCents,
    ceilingPriceCents: evt.ceilingPriceCents,
    nowMs,
    eventDateMs: evt.eventDate.getTime(),
    bookingsInLastHour: hourly,
    totalTickets: evt.totalTickets,
    bookedTickets: evt.bookedTickets,
    rules: evt.pricingRules,
    weights,
  });
}

export async function listUpcomingEventIds(db: DbClient) {
  const now = new Date(simClock.nowMs());
  return db
    .select({ id: events.id })
    .from(events)
    .where(gt(events.eventDate, now))
    .orderBy(asc(events.eventDate));
}

export async function eventAggregates(db: DbClient, eventId: string) {
  const rows = await db.select().from(bookings).where(eq(bookings.eventId, eventId));
  const sold = rows.reduce((acc, r) => acc + r.quantity, 0);
  const revenue = rows.reduce((acc, r) => acc + r.totalPaidCents, 0);
  const avgUnit = sold === 0 ? 0 : Math.round(revenue / sold);
  return { sold, revenue, avgUnit };
}
