import { bookings, events } from "./schema.js";
import type { PricingRulesConfig } from "@repo/pricing";
import type { Database } from "./types.js";

export const defaultPricingRules = (): PricingRulesConfig => ({
  timeTiersDays: [
    { maxDaysUntilEventInclusive: 2, adjustment: 0.5 },
    { maxDaysUntilEventInclusive: 7, adjustment: 0.2 },
    { maxDaysUntilEventInclusive: 30, adjustment: 0 },
    { maxDaysUntilEventInclusive: 3650, adjustment: 0 },
  ],
  demand: {
    thresholdBookingsLastHour: 10,
    adjustmentWhenMet: 0.15,
    adjustmentWhenNotMet: 0,
  },
  inventory: {
    remainingFractionBelow: 0.2,
    adjustmentWhenLow: 0.25,
    adjustmentWhenNotLow: 0,
  },
});

export async function runSeed(db: Database) {
  const rules = defaultPricingRules();
  await db.transaction(async (tx) => {
    await tx.delete(bookings);
    await tx.delete(events);
  });

  const ins = await db.insert(events).values([
    {
      name: "Indie Night Opening",
      eventDate: new Date(Date.now() + 400 * 24 * 3600 * 1000),
      venue: "The Warehouse",
      description: "Local bands, limited capacity demo event.",
      totalTickets: 50,
      bookedTickets: 0,
      basePriceCents: 4999,
      currentPriceCents: 4999,
      floorPriceCents: 2500,
      ceilingPriceCents: 8999,
      pricingRules: rules,
    },
    {
      name: "Synthwave Alley",
      eventDate: new Date(Date.now() + 12 * 24 * 3600 * 1000),
      venue: "Harbor Amphitheatre",
      description: "Fast-selling show to showcase demand spikes.",
      totalTickets: 120,
      bookedTickets: 0,
      basePriceCents: 7500,
      currentPriceCents: 7500,
      floorPriceCents: 4000,
      ceilingPriceCents: 14999,
      pricingRules: rules,
    },
    {
      name: "Tomorrow Matinee Jazz",
      eventDate: new Date(Date.now() + 36 * 3600 * 1000),
      venue: "City Commons",
      description: "Ultra close-in date to visualize time tiers.",
      totalTickets: 24,
      bookedTickets: 20,
      basePriceCents: 6200,
      currentPriceCents: 6200,
      floorPriceCents: 3500,
      ceilingPriceCents: 9900,
      pricingRules: rules,
    },
  ]).returning({ id: events.id });

  const ctx = Date.now();
  if (ins[2]) {
    await db.insert(bookings).values([
      {
        eventId: ins[2].id,
        userEmail: "demo@minsky.in",
        quantity: 20,
        unitPriceCentsSnapshot: 6200,
        totalPaidCents: 20 * 6200,
        pricingContextMs: ctx,
      },
    ]);
  }
  return ins.length;
}
