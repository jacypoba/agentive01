"use client";

import { useState } from "react";
import type { PlanDefinition } from "@/lib/stripe/plans";

type PlanCardProps = {
  plan: PlanDefinition;
  priceLabel: string;
  isCurrent: boolean;
  isUpgrade: boolean;
  disabled?: boolean;
  onSelect: (planId: PlanDefinition["id"]) => Promise<void>;
};

export function PlanCard({
  plan,
  priceLabel,
  isCurrent,
  isUpgrade,
  disabled,
  onSelect,
}: PlanCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (isCurrent || disabled || loading) {
      return;
    }

    setLoading(true);
    try {
      await onSelect(plan.id);
    } finally {
      setLoading(false);
    }
  }

  return (
    <article
      className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
        plan.highlighted
          ? "border-[#0066FF]/40 bg-gradient-to-b from-[#0066FF]/10 to-transparent shadow-lg shadow-[#0066FF]/10"
          : "border-white/10 bg-white/[0.02]"
      } ${isCurrent ? "ring-1 ring-[#00D4FF]/40" : ""}`}
    >
      {isCurrent && (
        <span className="absolute -top-3 left-5 rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#00D4FF]">
          Current plan
        </span>
      )}

      {plan.highlighted && !isCurrent && (
        <span className="absolute -top-3 right-5 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/15 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0066FF]">
          Popular
        </span>
      )}

      <div className="mb-5">
        <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
        <p className="mt-2 min-h-[2.5rem] text-sm leading-relaxed text-white/45">
          {plan.description}
        </p>
      </div>

      <div className="mb-6">
        <p className="text-3xl font-semibold tracking-tight text-white">
          {priceLabel}
          <span className="ml-1 text-sm font-normal text-white/40">/mo</span>
        </p>
      </div>

      <ul className="mb-8 flex-1 space-y-2.5">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-white/60"
          >
            <span className="mt-0.5 text-[#00D4FF]" aria-hidden>
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={isCurrent || disabled || loading}
        onClick={handleClick}
        className={`w-full rounded-full px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          isCurrent
            ? "border border-white/10 bg-white/5 text-white/50"
            : plan.highlighted
              ? "bg-gradient-to-r from-[#0066FF] to-[#0088FF] text-white shadow-lg shadow-[#0066FF]/20 hover:shadow-[#0066FF]/30"
              : "border border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10"
        }`}
      >
        {loading
          ? "Redirecting…"
          : isCurrent
            ? "Current plan"
            : isUpgrade
              ? `Upgrade to ${plan.name}`
              : `Choose ${plan.name}`}
      </button>
    </article>
  );
}
