import type { Appraisal } from "./types";
import {
  CYCLE_STATUS_LABELS,
  annualCycleStatus,
} from "./types";
import { M_LEVEL_LABELS } from "./capability-framework";
import {
  capabilitySelfAverage,
  overallPerformanceScore,
  weightedKpiScore,
  averageCapabilityRating,
} from "./kpi-utils";
import { ratingLabel } from "./ratings";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatOverall(score: number | null): {
  numeric: string;
  label: string;
} {
  if (score == null || Number.isNaN(score)) {
    return { numeric: "", label: "" };
  }
  const rounded = Math.min(5, Math.max(1, Math.round(score)));
  return {
    numeric: score.toFixed(2),
    label: ratingLabel(rounded),
  };
}

/** Final manager overall: override if set, else blended KPI + capability. */
export function appraisalOverallScore(a: Appraisal): number | null {
  if (a.managerOverallOverride != null) {
    return a.managerOverallOverride;
  }
  const kpiMgr = weightedKpiScore(a.kpis, "manager");
  const capMgr = (() => {
    const merged = a.capabilities.map((c) => c.managerRating ?? c.selfRating);
    if (merged.some((n) => n == null)) return null;
    return averageCapabilityRating(merged as number[]);
  })();
  return overallPerformanceScore(kpiMgr, capMgr);
}

export function appraisalSelfOverallScore(a: Appraisal): number | null {
  const kpiSelf = weightedKpiScore(a.kpis, "self");
  const capSelf = capabilitySelfAverage(a.capabilities);
  return overallPerformanceScore(kpiSelf, capSelf);
}

/**
 * HR listing export — employee details, level, overall score, comments.
 * Downloads a CSV in the browser.
 */
export function downloadHrAppraisalReport(
  appraisals: Appraisal[],
  cycleYear: number
): void {
  const headers = [
    "Reference",
    "Cycle",
    "Employee",
    "English name",
    "Position",
    "Department",
    "Entity",
    "M level",
    "Level label",
    "Manager",
    "Mid-Year status",
    "Annual status",
    "Appraisal status",
    "Overall score (manager)",
    "Overall rating (manager)",
    "Overall score (employee self)",
    "Overall rating (employee self)",
    "Employee comments",
    "Manager comments",
    "Mid-Year manager comments",
  ];

  const rows = appraisals.map((a) => {
    let h = 0;
    for (let i = 0; i < a.id.length; i++) {
      h = (Math.imul(31, h) + a.id.charCodeAt(i)) >>> 0;
    }
    const seq = (h % 99_998) + 1;
    const reference = `HR-APR-${a.cycleYear}-${String(seq).padStart(5, "0")}`;

    const mgr = formatOverall(appraisalOverallScore(a));
    const self = formatOverall(appraisalSelfOverallScore(a));
    const level = Math.min(10, Math.max(1, Math.round(a.mLevel || 1)));

    return [
      reference,
      `${a.cycleYear} Annual Appraisal`,
      a.employeeName || "",
      a.englishName || "",
      a.position || "",
      a.department || "",
      a.entity || "",
      String(level),
      M_LEVEL_LABELS[level] ?? `L${level}`,
      a.managerName || "",
      CYCLE_STATUS_LABELS[a.midYearStatus] ?? a.midYearStatus,
      CYCLE_STATUS_LABELS[annualCycleStatus(a.status, a.midYearStatus)] ?? "",
      a.status,
      mgr.numeric,
      mgr.label,
      self.numeric,
      self.label,
      a.employeeComments || "",
      a.managerComments || "",
      a.midYearManagerComments || "",
    ].map((cell) => csvEscape(String(cell)));
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `HR-appraisal-report-${cycleYear}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
