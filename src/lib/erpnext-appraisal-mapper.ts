/**
 * ERPNext <-> app `Appraisal` shape conversion, in one place.
 *
 * WHY THIS EXISTS SEPARATELY FROM erpnext.ts
 *
 * erpnext.ts is the transport plus the (soon to be retired) one-way mirror
 * writes. This module is pure, network-free shape translation, so it can be
 * reasoned about and tested without a live ERPNext. Both directions live
 * here deliberately: a field added to one direction and forgotten in the
 * other is exactly the kind of silent data loss this migration exists to
 * stop - per-KPI manager comments were dropped for months precisely because
 * the read and write halves lived apart and nobody could see the gap.
 *
 * WHAT THE BACKEND ALREADY DID FOR US
 *
 * `aemg_epm_frappe.api.appraisal_read` returns AEMG 1-5 integers, not
 * ERPNext's raw storage. Capabilities are stored as 0-1 fractions and goals
 * as 0-5, and that conversion happens server-side in utils/scale.py so it
 * has exactly one home. Nothing in this file should ever multiply or divide
 * a rating - if a rating here looks 5x off, the bug is server-side.
 *
 * STATUS IS DERIVED, NOT STORED
 *
 * The app's flat `status` is redundant given ERPNext's three status fields,
 * so it is computed here rather than persisted. Storing a fourth copy would
 * let it drift out of sync with the three that already encode it, which is
 * the corruption `hr_override_appraisal`'s own docstring warns about.
 */

import type {
  Appraisal,
  AppraisalStatus,
  CapabilityId,
  CapabilityRow,
  CycleStatus,
  KpiRow,
  MidYearRating,
} from "./types";
import { CAPABILITY_ORDER } from "./types";

/** Shape returned by `appraisal_read.get_appraisal` / `list_appraisals`. */
export type ErpGoal = {
  kra: string;
  per_weightage: number;
  due_date: string | null;
  self_rating: number | null;
  manager_rating: number | null;
  manager_comment: string;
  mid_year_rating: string;
  mid_year_comment: string;
};

export type ErpCapability = {
  criteria: string;
  self_rating: number | null;
  manager_rating: number | null;
  mid_year_rating: number | null;
  manager_comment: string;
  mid_year_comment: string;
};

export type ErpAppraisal = {
  name: string;
  employee: string;
  employee_name: string;
  appraisal_cycle: string;
  cycle_year: number | null;
  designation: string;
  department: string;
  company: string;
  docstatus: number;
  modified: string;
  m_level: number;
  entity: string;
  manager: string | null;
  manager_name: string;
  kpi_status: string;
  mid_year_status: string;
  annual_status: string;
  mid_year_manager_comments: string;
  manager_overall_override: number | null;
  employee_comments: string;
  manager_comments: string;
  annual_self_complete?: boolean;
  goals?: ErpGoal[];
  capabilities?: ErpCapability[];
};

/**
 * ERPNext's Select values <-> the app's snake_case MidYearRating.
 *
 * `early_access` used to be dropped to "" on the way out even though the
 * ERPNext Select has always carried "Too early to assess" - a silent
 * downgrade of a real answer to no answer. Both arms are present here.
 */
const MID_YEAR_TO_APP: Record<string, MidYearRating> = {
  "On Track": "on_track",
  "Not on Track": "not_on_track",
  "Too early to assess": "early_access",
};

const MID_YEAR_TO_ERP: Record<MidYearRating, string> = {
  on_track: "On Track",
  not_on_track: "Not on Track",
  early_access: "Too early to assess",
};

export function midYearRatingFromErp(value: string | null): MidYearRating | null {
  if (!value) return null;
  return MID_YEAR_TO_APP[value] ?? null;
}

export function midYearRatingToErp(value: MidYearRating | null): string {
  return value ? (MID_YEAR_TO_ERP[value] ?? "") : "";
}

/** App CapabilityId <-> ERPNext `Employee Feedback Criteria` display name. */
const CAPABILITY_TO_CRITERIA: Record<CapabilityId, string> = {
  planning: "Planning",
  leadership: "Leadership",
  financial_management: "Financial Management",
  strategic_execution: "Strategic Execution",
  communication: "Communication",
};

const CRITERIA_TO_CAPABILITY: Record<string, CapabilityId> = Object.fromEntries(
  (Object.entries(CAPABILITY_TO_CRITERIA) as [CapabilityId, string][]).map(
    ([id, label]) => [label, id]
  )
);

export function criteriaForCapability(id: CapabilityId): string {
  return CAPABILITY_TO_CRITERIA[id];
}

/**
 * The app's flat `status`, derived from ERPNext's three.
 *
 * Total and one-way, so it cannot corrupt anything. Matches the transitions
 * in api/appraisals/[id]/route.ts: employee_submit moves draft -> submitted
 * (and mid-year to kpi_created) together, manager_submit -> reviewed,
 * manager_complete -> completed.
 */
export function statusFromErp(doc: {
  kpi_status: string;
  annual_status: string;
}): AppraisalStatus {
  if (doc.kpi_status === "Not Started") return "draft";
  if (doc.annual_status === "Completed") return "completed";
  if (doc.annual_status === "Reviewed") return "reviewed";
  return "submitted";
}

/**
 * The app's `midYearStatus`, from ERPNext's KPI + mid-year pair.
 *
 * The app collapses two ERPNext fields into one enum: the KPI approval gate
 * (Not Started -> KPI Created -> KPI Approved) runs BEFORE the mid-year
 * checkpoint (Draft -> Submitted -> Completed) and they share a column in
 * the UI. This is the inverse of erpKpiAndMidYearStatus in erpnext.ts.
 */
export function midYearStatusFromErp(doc: {
  kpi_status: string;
  mid_year_status: string;
}): CycleStatus {
  if (doc.kpi_status === "Not Started") return "not_started";
  if (doc.kpi_status === "KPI Created") return "kpi_created";
  // KPI Approved: the mid-year checkpoint itself now drives the value.
  switch (doc.mid_year_status) {
    case "Draft":
      return "draft";
    case "Submitted":
      return "submitted";
    case "Completed":
      return "completed";
    default:
      return "kpi_approved";
  }
}

function kpiFromErp(g: ErpGoal): KpiRow {
  return {
    goalsAndKpis: g.kra ?? "",
    weightPercent: Number(g.per_weightage) || 0,
    dueDate: g.due_date ?? "",
    selfRating: g.self_rating ?? null,
    managerRating: g.manager_rating ?? null,
    managerComments: g.manager_comment ?? "",
    midYearRating: midYearRatingFromErp(g.mid_year_rating),
    midYearComment: g.mid_year_comment ?? "",
  };
}

/**
 * Capabilities, always all five in CAPABILITY_ORDER.
 *
 * The UI indexes these positionally, so a short or reordered list would
 * shift every later row onto the wrong capability. The backend already
 * guarantees the order, but rebuilding from CAPABILITY_ORDER here means a
 * future backend change cannot quietly misalign ratings - an unrecognised
 * criteria simply doesn't match and shows blank rather than landing on its
 * neighbour.
 */
function capabilitiesFromErp(rows: ErpCapability[] | undefined): CapabilityRow[] {
  const byId = new Map<CapabilityId, ErpCapability>();
  for (const row of rows ?? []) {
    const id = CRITERIA_TO_CAPABILITY[row.criteria];
    if (id) byId.set(id, row);
  }
  return CAPABILITY_ORDER.map((id) => {
    const row = byId.get(id);
    return {
      id,
      selfRating: row?.self_rating ?? null,
      managerRating: row?.manager_rating ?? null,
      managerComments: row?.manager_comment ?? "",
      midYearRating: row?.mid_year_rating ?? null,
      midYearComment: row?.mid_year_comment ?? "",
    };
  });
}

/**
 * Full ERPNext record -> the app's `Appraisal`.
 *
 * `id` is ERPNext's own name (HR-APR-YYYY-NNNNN). Routes take an opaque
 * string, so nothing about `/appraisal/[id]` changes and the old UUID
 * concept simply disappears - no mapping table, which matters because a
 * mapping table would need a persistent home, the exact thing production
 * does not have and this migration exists to fix.
 */
export function appraisalFromErpnext(doc: ErpAppraisal): Appraisal {
  return {
    id: doc.name,
    cycleYear: doc.cycle_year ?? new Date().getFullYear(),
    ownerUserId: doc.employee,
    reviewingManagerId: doc.manager ?? null,
    employeeName: doc.employee_name ?? "",
    englishName: doc.employee_name ?? "",
    position: doc.designation ?? "",
    department: doc.department ?? "",
    mLevel: Number(doc.m_level) || 3,
    managerName: doc.manager_name ?? "",
    entity: doc.entity ?? "",
    status: statusFromErp(doc),
    midYearStatus: midYearStatusFromErp(doc),
    midYearManagerComments: doc.mid_year_manager_comments ?? "",
    kpis: (doc.goals ?? []).map(kpiFromErp),
    capabilities: capabilitiesFromErp(doc.capabilities),
    employeeComments: doc.employee_comments ?? "",
    managerComments: doc.manager_comments ?? "",
    managerOverallOverride: doc.manager_overall_override ?? null,
  };
}

/**
 * KPI rows for hr_override_appraisal, which FULL-REPLACES the goals table.
 *
 * Separate from kpisToErpGoals deliberately. That one sends only the three
 * fields an employee owns at KPI time, which is right for update_kpis - but
 * handing the same payload to the HR override erases every rating and
 * comment on the record, because whatever is absent from a full replace is
 * gone. That is not hypothetical: it happened during the end-to-end run and
 * wiped a completed appraisal's scores.
 */
export function kpisToErpGoalsFull(kpis: KpiRow[]): Record<string, unknown>[] {
  return kpis.map((k) => ({
    kra: k.goalsAndKpis,
    per_weightage: Number(k.weightPercent) || 0,
    aemg_due_date: k.dueDate || null,
    aemg_self_score: k.selfRating,
    score: k.managerRating,
    aemg_manager_comment: k.managerComments ?? "",
    aemg_mid_year_rating: midYearRatingToErp(k.midYearRating),
    aemg_mid_year_comment: k.midYearComment ?? "",
  }));
}

/** KPI rows -> the `goals` payload `update_kpis` expects. */
export function kpisToErpGoals(
  kpis: KpiRow[]
): { kra: string; per_weightage: number; aemg_due_date: string | null }[] {
  return kpis.map((k) => ({
    kra: k.goalsAndKpis,
    per_weightage: Number(k.weightPercent) || 0,
    aemg_due_date: k.dueDate || null,
  }));
}

/**
 * Rating payloads are matched POSITIONALLY by idx server-side, so these must
 * always be built from the full, unfiltered, unreordered KPI list. The
 * backend now asserts the row count matches, which turns a mistake here into
 * a loud error rather than ratings silently landing on the wrong KPI.
 */
export function kpiSelfRatingsToErp(
  kpis: KpiRow[]
): { idx: number; aemg_self_score: number | null }[] {
  return kpis.map((k, i) => ({ idx: i + 1, aemg_self_score: k.selfRating }));
}

export function kpiManagerRatingsToErp(
  kpis: KpiRow[]
): { idx: number; score: number | null; aemg_manager_comment: string }[] {
  return kpis.map((k, i) => ({
    idx: i + 1,
    score: k.managerRating,
    aemg_manager_comment: k.managerComments ?? "",
  }));
}

export function kpiMidYearToErp(
  kpis: KpiRow[]
): { idx: number; aemg_mid_year_rating: string; aemg_mid_year_comment: string }[] {
  return kpis.map((k, i) => ({
    idx: i + 1,
    aemg_mid_year_rating: midYearRatingToErp(k.midYearRating),
    aemg_mid_year_comment: k.midYearComment ?? "",
  }));
}

export function kpiMidYearCommentsToErp(
  kpis: KpiRow[]
): { idx: number; aemg_mid_year_comment: string }[] {
  return kpis.map((k, i) => ({
    idx: i + 1,
    aemg_mid_year_comment: k.midYearComment ?? "",
  }));
}

/** Capability payloads are matched by `criteria`, not position. */
export function capabilitySelfRatingsToErp(
  rows: CapabilityRow[]
): { criteria: string; rating: number | null }[] {
  return rows.map((c) => ({
    criteria: criteriaForCapability(c.id),
    rating: c.selfRating,
  }));
}

export function capabilityManagerRatingsToErp(
  rows: CapabilityRow[]
): { criteria: string; aemg_manager_rating: number | null; aemg_manager_comment: string }[] {
  return rows.map((c) => ({
    criteria: criteriaForCapability(c.id),
    aemg_manager_rating: c.managerRating,
    aemg_manager_comment: c.managerComments ?? "",
  }));
}
