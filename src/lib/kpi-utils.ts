import type { CapabilityRow, KpiRow } from "./types";

export function sumKpiWeights(kpis: KpiRow[]): number {
  return kpis.reduce((s, k) => s + (Number(k.weightPercent) || 0), 0);
}

/**
 * Weighted KPI score (1–5 scale): Σ(weight% × rating) / Σ(weight%).
 * Same as Σ (weight/100 × rating) when weights total 100%.
 */
export function weightedKpiScore(
  kpis: KpiRow[],
  which: "self" | "manager"
): number | null {
  if (kpis.length === 0) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const k of kpis) {
    const w = Math.max(0, Number(k.weightPercent) || 0);
    const r =
      which === "self"
        ? k.selfRating
        : k.managerRating ?? k.selfRating;
    if (r == null || Number.isNaN(r)) return null;
    weightedSum += w * r;
    weightTotal += w;
  }
  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}

export function averageCapabilityRating(
  ratings: number[]
): number | null {
  const nums = ratings.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Average of self ratings; null if any capability is unset. */
export function capabilitySelfAverage(rows: CapabilityRow[]): number | null {
  if (rows.length === 0 || rows.some((r) => r.selfRating == null)) {
    return null;
  }
  return averageCapabilityRating(rows.map((r) => r.selfRating!));
}

/** Same weighting as `weightedKpiScore(..., "manager")` but from draft ratings only. */
export function weightedKpiScoreFromManagerDraft(
  kpis: KpiRow[],
  managerRatings: (number | null)[]
): number | null {
  if (kpis.length !== managerRatings.length) return null;
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < kpis.length; i++) {
    const k = kpis[i]!;
    const r = managerRatings[i];
    if (r == null) return null;
    const w = Math.max(0, Number(k.weightPercent) || 0);
    weightedSum += w * r;
    weightTotal += w;
  }
  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
}

/** Capability average from parallel draft; null if any rating unset. */
export function capabilityAverageFromDraft(
  ratings: (number | null)[]
): number | null {
  if (ratings.length === 0 || ratings.some((r) => r == null)) return null;
  return averageCapabilityRating(ratings as number[]);
}

/** Blend weighted KPI score (1–5) and capability average (1–5). */
export function overallPerformanceScore(
  kpiScore: number | null,
  capScore: number | null
): number | null {
  if (kpiScore != null && capScore != null) {
    return (kpiScore + capScore) / 2;
  }
  if (kpiScore != null) return kpiScore;
  if (capScore != null) return capScore;
  return null;
}
