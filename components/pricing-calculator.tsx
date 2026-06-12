"use client";

import { useState } from "react";

const TIER_LABELS: Record<string, string> = {
  standard: "Standard pricing",
  growth: "Growth pricing (5–9 locations)",
  enterprise: "Volume pricing (10–25 locations)",
};

function getPricing(locations: number) {
  const tier =
    locations >= 10 ? "enterprise" : locations >= 5 ? "growth" : "standard";
  const monthly = { standard: 199, growth: 169, enterprise: 149 }[tier]!;
  const annual = { standard: 1990, growth: 1690, enterprise: 1490 }[tier]!;
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

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function PricingCalculator() {
  const [locations, setLocations] = useState(1);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const clamped = Math.min(99, Math.max(1, locations));
  const overCap = clamped > 25;
  const p = getPricing(Math.min(clamped, 25));

  function setCount(n: number) {
    setLocations(Math.min(99, Math.max(1, n)));
  }

  const cardBase =
    "flex-1 cursor-pointer rounded-[10px] border bg-white p-6 text-left transition-shadow";
  const selected =
    "border-2 border-amber shadow-[0_4px_14px_rgba(28,47,94,0.12)]";
  const unselected = "border border-line shadow-[0_1px_3px_rgba(28,47,94,0.08)]";

  return (
    <div className="mx-auto max-w-[680px]">
      {/* Location count */}
      <div className="text-center">
        <label
          htmlFor="locations"
          className="font-brand text-[11px] font-bold uppercase tracking-[1px] text-steel"
        >
          How many locations?
        </label>
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Fewer locations"
            onClick={() => setCount(clamped - 1)}
            className="h-11 w-11 rounded-md border border-line font-brand text-lg font-bold text-navy hover:bg-cloud"
          >
            −
          </button>
          <input
            id="locations"
            type="number"
            min={1}
            max={99}
            value={locations}
            onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
            className="h-11 w-24 rounded-md border-[1.5px] border-line text-center font-brand text-xl font-bold text-navy focus:border-navy focus:outline-none focus:ring-[3px] focus:ring-navy/10"
          />
          <button
            type="button"
            aria-label="More locations"
            onClick={() => setCount(clamped + 1)}
            className="h-11 w-11 rounded-md border border-line font-brand text-lg font-bold text-navy hover:bg-cloud"
          >
            +
          </button>
        </div>
        {!overCap && (
          <p className="mt-2 font-body text-xs text-steel">
            {TIER_LABELS[p.tier]}
          </p>
        )}
      </div>

      {overCap ? (
        <div className="mt-8 rounded-[10px] border border-line bg-cloud p-8 text-center">
          <p className="font-brand text-lg font-bold text-navy">
            For 26+ locations, contact us for custom pricing.
          </p>
          <a
            href="mailto:info@rxshift.io"
            className="mt-3 inline-block font-body text-sm font-medium text-amber hover:underline"
          >
            info@rxshift.io
          </a>
        </div>
      ) : (
        <>
          {/* Price cards — both always visible */}
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`${cardBase} ${billing === "monthly" ? selected : unselected}`}
            >
              <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-steel">
                Monthly
              </p>
              <p className="mt-2 font-brand text-[32px] font-bold text-navy">
                {fmt(p.monthly)}
                <span className="text-sm font-medium text-steel">
                  /location/month
                </span>
              </p>
              <p className="mt-1 font-body text-sm text-steel">
                Total: {fmt(p.monthlyTotal)}/month
              </p>
            </button>

            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={`relative ${cardBase} ${billing === "annual" ? selected : unselected}`}
            >
              <span className="absolute right-3 top-3 rounded-[4px] bg-amber/[0.12] px-1.5 py-0.5 font-brand text-[9px] font-bold uppercase text-amber">
                Save 2 months
              </span>
              <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-steel">
                Annual
              </p>
              <p className="mt-2 font-brand text-[32px] font-bold text-navy">
                {fmt(p.annual)}
                <span className="text-sm font-medium text-steel">
                  /location/year
                </span>
              </p>
              <p className="mt-1 font-body text-sm text-steel">
                ~{fmt(p.annualEffectiveMonthly)}/location/month
              </p>
            </button>
          </div>

          {/* Total */}
          <div className="mt-6 text-center">
            <p className="font-brand text-xl font-bold text-navy">
              Your total:{" "}
              {billing === "monthly"
                ? `${fmt(p.monthlyTotal)}/month`
                : `${fmt(p.annualTotal)}/year`}
            </p>
            {billing === "annual" && (
              <p className="mt-1 font-body text-sm text-[#2E7D5E]">
                You save {fmt(p.annualTotalSavings)}/year compared to monthly
              </p>
            )}
            <a
              href="#demo-form"
              className="mt-5 inline-block rounded-md bg-amber px-6 py-3 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
            >
              Schedule a Walkthrough
            </a>
          </div>
        </>
      )}
    </div>
  );
}
