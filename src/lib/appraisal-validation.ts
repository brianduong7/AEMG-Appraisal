/**
 * Submit-time validation, shared by the local and ERPNext write paths.
 *
 * Extracted from api/appraisals/[id]/route.ts so both backends enforce the
 * same rules and, more importantly, produce the same wording. ERPNext does
 * validate independently - it has to, since it is the store - but its
 * messages are written for an API caller, and "Total weightage must be
 * 100%" is a worse thing to show an employee than telling them which of
 * their KPIs still needs a weight. Checking here first keeps the friendly
 * message and leaves ERPNext as the authority that cannot be bypassed.
 */

import type { CapabilityRow, KpiRow, MidYearRating } from "./types";
import { MAX_KPIS, MIN_KPIS } from "./types";
import { sumKpiWeights } from "./kpi-utils";

/** Initial KPI lock — weights and KPI text only; no self-ratings yet. */
export function employeeKpiSubmitValidationError(kpis: KpiRow[]): string | null {
  if (kpis.length < MIN_KPIS) {
    return `Add at least ${MIN_KPIS} KPIs before submitting.`;
  }
  if (kpis.length > MAX_KPIS) {
    return `Maximum ${MAX_KPIS} KPIs.`;
  }
  for (const k of kpis) {
    if ((Number(k.weightPercent) || 0) <= 0) {
      return "Each KPI must have a weight greater than 0%.";
    }
  }
  const total = sumKpiWeights(kpis);
  if (Math.abs(total - 100) >= 0.01) {
    return "KPI weights must total exactly 100% before submitting.";
  }
  return null;
}

export function employeeAnnualSubmitValidationError(
  kpis: KpiRow[],
  capabilities: CapabilityRow[]
): string | null {
  for (const k of kpis) {
    if (k.selfRating == null) {
      return "Select a self rating for every KPI before submitting.";
    }
  }
  for (const c of capabilities) {
    if (c.selfRating == null) {
      return "Select a self rating for every capability before submitting.";
    }
  }
  return null;
}

export function employeeMidYearSubmitValidationError(
  lines: { midYearRating: MidYearRating | null }[]
): string | null {
  for (const l of lines) {
    if (l.midYearRating == null) {
      return "Select On Track / Not on Track for every KPI before submitting your mid-year review.";
    }
  }
  return null;
}
