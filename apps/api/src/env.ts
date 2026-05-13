import type { PricingWeights } from "@repo/pricing";

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function pricingWeightsFromEnv(): PricingWeights {
  return {
    time: numEnv("PRICING_WEIGHT_TIME", 1),
    demand: numEnv("PRICING_WEIGHT_DEMAND", 1),
    inventory: numEnv("PRICING_WEIGHT_INVENTORY", 1),
  };
}

export function adminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY;
}
