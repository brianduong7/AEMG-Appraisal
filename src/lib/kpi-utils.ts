import type { KpiRow } from "./types";

export function sumKpiWeights(kpis: KpiRow[]): number {
  return kpis.reduce((s, k) => s + (Number(k.weightPercent) || 0), 0);
}

/**
 * Simple arithmetic mean of KPI ratings (1–5), one value per row.
 * e.g. one KPI rated 2 → average 2 (not weight × rating).
 */
export function averageKpiRating(
  kpis: KpiRow[],
  which: "self" | "manager"
): number | null {
  if (kpis.length === 0) return null;
  let sum = 0;
  let n = 0;
  for (const k of kpis) {
    const r =
      which === "self"
        ? k.selfRating
        : k.managerRating ?? k.selfRating;
    if (typeof r === "number" && !Number.isNaN(r)) {
      sum += r;
      n += 1;
    }
  }
  if (n === 0) return null;
  return sum / n;
}

export function averageCapabilityRating(
  ratings: number[]
): number | null {
  const nums = ratings.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Blend KPI rating average (1–5) and capability average (1–5). */
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
