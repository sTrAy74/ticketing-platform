import { describe, expect, it } from "vitest";
import {
  computeTicketPrice,
  demandAdjustment,
  inventoryAdjustment,
  timeAdjustment,
} from "./index.js";
import type { PricingComputationInput, PricingRulesConfig } from "./types.js";

const baseRules = (): PricingRulesConfig => ({
  timeTiersDays: [
    { maxDaysUntilEventInclusive: 2, adjustment: 0.5 },
    { maxDaysUntilEventInclusive: 7, adjustment: 0.2 },
    { maxDaysUntilEventInclusive: 30, adjustment: 0 },
    { maxDaysUntilEventInclusive: 9999, adjustment: 0 },
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

describe("timeAdjustment", () => {
  it("applies the tightest matching tier (tomorrow)", () => {
    const event = Date.now() + 1.2 * 24 * 60 * 60 * 1000;
    expect(timeAdjustment(Date.now(), event, baseRules())).toBe(0.5);
  });

  it("uses within-7-days tier", () => {
    const event = Date.now() + 5 * 24 * 60 * 60 * 1000;
    expect(timeAdjustment(Date.now(), event, baseRules())).toBe(0.2);
  });

  it("uses far-out tier", () => {
    const event = Date.now() + 45 * 24 * 60 * 60 * 1000;
    expect(timeAdjustment(Date.now(), event, baseRules())).toBe(0);
  });
});

describe("demandAdjustment", () => {
  it("returns met adjustment above threshold", () => {
    expect(demandAdjustment(11, baseRules())).toBe(0.15);
  });

  it("returns zero when demand rule missing", () => {
    const r = { ...baseRules(), demand: undefined };
    expect(demandAdjustment(100, r)).toBe(0);
  });
});

describe("inventoryAdjustment", () => {
  it("fires when fewer than configured fraction remains", () => {
    expect(inventoryAdjustment(100, 85, baseRules())).toBe(0.25);
  });

  it("is neutral when ample inventory", () => {
    expect(inventoryAdjustment(100, 50, baseRules())).toBe(0);
  });

  it("handles zero capacity safely", () => {
    expect(inventoryAdjustment(0, 0, baseRules())).toBe(0);
  });
});

describe("computeTicketPrice", () => {
  const input = (partial: Partial<PricingComputationInput>): PricingComputationInput => ({
    basePriceCents: 10_000,
    floorPriceCents: 5_000,
    ceilingPriceCents: 25_000,
    nowMs: Date.now(),
    eventDateMs: Date.now() + 50 * 24 * 60 * 60 * 1000,
    bookingsInLastHour: 0,
    totalTickets: 200,
    bookedTickets: 20,
    rules: baseRules(),
    weights: { time: 1, demand: 1, inventory: 1 },
    ...partial,
  });

  it("respects ceiling", () => {
    const r = computeTicketPrice(
      input({
        basePriceCents: 100_000,
        weights: { time: 1, demand: 1, inventory: 1 },
        eventDateMs: Date.now() + 0.5 * 24 * 60 * 60 * 1000,
        bookingsInLastHour: 20,
        totalTickets: 100,
        bookedTickets: 95,
        ceilingPriceCents: 12_000,
        floorPriceCents: 100,
      }),
    );
    expect(r.unitPriceCents).toBe(12_000);
  });

  it("respects floor", () => {
    const r = computeTicketPrice(
      input({
        basePriceCents: 100,
        floorPriceCents: 500,
        ceilingPriceCents: 50_000,
      }),
    );
    expect(r.unitPriceCents).toBe(500);
  });

  it("combines weighted rules deterministically", () => {
    const now = Date.parse("2030-01-01T00:00:00.000Z");
    const evt = Date.parse("2030-01-06T12:00:00.000Z"); // ~5.5 days
    const one = computeTicketPrice(
      input({
        nowMs: now,
        eventDateMs: evt,
        bookingsInLastHour: 0,
        bookedTickets: 10,
        totalTickets: 100,
        weights: { time: 1, demand: 1, inventory: 1 },
      }),
    );
    const two = computeTicketPrice(
      input({
        nowMs: now,
        eventDateMs: evt,
        bookingsInLastHour: 0,
        bookedTickets: 10,
        totalTickets: 100,
        weights: { time: 1, demand: 1, inventory: 1 },
      }),
    );
    expect(one.unitPriceCents).toBe(two.unitPriceCents);
    expect(one.adjustments.time).toBeGreaterThanOrEqual(one.adjustments.demand);
  });

  it("scales adjustments by weights without changing purity", () => {
    const base = computeTicketPrice(
      input({
        weights: { time: 1, demand: 0, inventory: 0 },
        eventDateMs: Date.now() + 3 * 24 * 60 * 60 * 1000,
      }),
    );
    const half = computeTicketPrice(
      input({
        weights: { time: 0.5, demand: 0, inventory: 0 },
        eventDateMs: Date.now() + 3 * 24 * 60 * 60 * 1000,
      }),
    );
    expect(base.adjustments.time).toBe(half.adjustments.time);
    expect(half.unitPriceCents).toBeLessThanOrEqual(base.unitPriceCents);
  });
});
