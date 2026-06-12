// THE single source of pricing truth — used by the marketing calculator
// and the billing scaffold. When Stripe lands, its price objects mirror
// these numbers; change them here first.

export type PricingTier = "standard" | "growth" | "enterprise";

export const TIER_LABELS: Record<PricingTier, string> = {
  standard: "Standard pricing",
  growth: "Growth pricing (5–9 locations)",
  enterprise: "Volume pricing (10–25 locations)",
};

export function getPricing(locations: number) {
  const tier: PricingTier =
    locations >= 10 ? "enterprise" : locations >= 5 ? "growth" : "standard";
  const monthly = { standard: 199, growth: 169, enterprise: 149 }[tier];
  const annual = { standard: 1990, growth: 1690, enterprise: 1490 }[tier];
  return {
    tier,
    monthly,
    annual,
    annualEffectiveMonthly: Math.round(annual / 12),
    annualSavingsVsMonthly: monthly * 12 - annual,
    monthlyTotal: monthly * locations,
    annualTotal: annual * locations,
    annualTotalSavings: (monthly * 12 - annual) * locations,
  };
}
