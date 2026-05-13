/** JSON stored on `events.pricing_rules` - validated again at booking/read time in the API layer. */
export type PricingRulesConfig = {
  timeTiersDays: Array<{
    /** Inclusive upper bound on calendar days-until-event (fractional OK). Larger windows should appear later so the first match wins. */
    maxDaysUntilEventInclusive: number;
    adjustment: number;
  }>;
  demand?: {
    thresholdBookingsLastHour: number;
    adjustmentWhenMet: number;
    adjustmentWhenNotMet?: number;
  };
  inventory?: {
    /** Trigger when remaining share is strictly below this threshold (e.g. 0.2 = fewer than 20% left). */
    remainingFractionBelow: number;
    adjustmentWhenLow: number;
    adjustmentWhenNotLow?: number;
  };
};

export type PricingWeights = {
  time: number;
  demand: number;
  inventory: number;
};

export type PricingComputationInput = {
  basePriceCents: number;
  floorPriceCents: number;
  ceilingPriceCents: number;
  nowMs: number;
  eventDateMs: number;
  bookingsInLastHour: number;
  totalTickets: number;
  bookedTickets: number;
  rules: PricingRulesConfig;
  weights: PricingWeights;
};

export type PricingBreakdown = {
  /** Final unit price before quantity multiplier. */
  unitPriceCents: number;
  /** Multiplier additions that feed `base * (1 + sum(...))`. */
  adjustments: {
    time: number;
    demand: number;
    inventory: number;
  };
  weightedSum: number;
};
