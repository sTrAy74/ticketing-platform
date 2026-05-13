import type {
  PricingBreakdown,
  PricingComputationInput,
  PricingRulesConfig,
} from "./types.js";

function msDays(ms: number): number {
  return ms / (1000 * 60 * 60 * 24);
}

export function timeAdjustment(nowMs: number, eventDateMs: number, rules: PricingRulesConfig): number {
  if (rules.timeTiersDays.length === 0) return 0;
  const delta = Math.max(0, eventDateMs - nowMs);
  const daysUntil = msDays(delta);
  /** Narrowest windows first so “tomorrow” beats the broader “within a week” band. */
  const tiers = [...rules.timeTiersDays].sort(
    (a, b) => a.maxDaysUntilEventInclusive - b.maxDaysUntilEventInclusive,
  );
  for (const tier of tiers) {
    if (daysUntil <= tier.maxDaysUntilEventInclusive) return tier.adjustment;
  }
  /** Far beyond the largest bucket - treat as the calmest band. */
  return 0;
}

export function demandAdjustment(bookingsInLastHour: number, rules: PricingRulesConfig): number {
  const cfg = rules.demand;
  if (!cfg) return 0;
  return bookingsInLastHour > cfg.thresholdBookingsLastHour
    ? cfg.adjustmentWhenMet
    : (cfg.adjustmentWhenNotMet ?? 0);
}

export function inventoryAdjustment(
  totalTickets: number,
  bookedTickets: number,
  rules: PricingRulesConfig,
): number {
  const cfg = rules.inventory;
  if (!cfg) return 0;
  if (totalTickets <= 0) return 0;
  const remaining = Math.max(0, totalTickets - bookedTickets);
  const remainingFraction = remaining / totalTickets;
  const isLow = remainingFraction < cfg.remainingFractionBelow;
  return isLow ? cfg.adjustmentWhenLow : (cfg.adjustmentWhenNotLow ?? 0);
}

/** `currentPrice = basePrice × (1 + sum(weight_i × adjustment_i))` then clamp to floor/ceiling. */
export function computeTicketPrice(input: PricingComputationInput): PricingBreakdown {
  const adjTime = timeAdjustment(input.nowMs, input.eventDateMs, input.rules);
  const adjDemand = demandAdjustment(input.bookingsInLastHour, input.rules);
  const adjInv = inventoryAdjustment(
    input.totalTickets,
    input.bookedTickets,
    input.rules,
  );

  const weightedSum =
    input.weights.time * adjTime +
    input.weights.demand * adjDemand +
    input.weights.inventory * adjInv;

  const raw = input.basePriceCents * (1 + weightedSum);
  const clamped = Math.min(
    input.ceilingPriceCents,
    Math.max(input.floorPriceCents, Math.round(raw)),
  );

  return {
    unitPriceCents: clamped,
    adjustments: {
      time: adjTime,
      demand: adjDemand,
      inventory: adjInv,
    },
    weightedSum,
  };
}

export * from "./types.js";
