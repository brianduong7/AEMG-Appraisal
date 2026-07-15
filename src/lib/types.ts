export type AppraisalStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  /** Manager finalized and sent to HR; record is locked. */
  | "completed";

/**
 * Mid-Year column status (also covers early-year KPI gate).
 * KPI Created → KPI Approved, then mid-year draft/submitted/completed.
 */
export type CycleStatus =
  | "not_started"
  | "kpi_created"
  | "kpi_approved"
  | "draft"
  | "submitted"
  | "completed";

/** Mid-Year checkpoint rating per KPI (employee self-assessment). */
export type MidYearRating = "on_track" | "not_on_track" | "early_access";

export const MID_YEAR_RATING_OPTIONS: MidYearRating[] = [
  "on_track",
  "not_on_track",
  /* Not currently applicable but kept available if required. */
  "early_access",
];

export const MID_YEAR_RATING_LABELS: Record<MidYearRating, string> = {
  on_track: "On Track",
  not_on_track: "Not on Track",
  early_access: "Too early to access",
};

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  not_started: "Not Started",
  kpi_created: "KPI Created",
  kpi_approved: "KPI Approved",
  draft: "Draft",
  submitted: "Submitted",
  completed: "Completed",
};

/** Annual workflow status → reporting cycle status (HR two-column report). */
export function annualCycleStatus(
  status: AppraisalStatus,
  midYearStatus?: CycleStatus
): CycleStatus {
  if (status === "draft") return "draft";
  if (status === "completed") return "completed";
  /* Annual stays Draft until mid-year is completed. */
  if (
    midYearStatus === "not_started" ||
    midYearStatus === "kpi_created" ||
    midYearStatus === "kpi_approved" ||
    midYearStatus === "draft" ||
    midYearStatus === "submitted"
  ) {
    return "draft";
  }
  if (status === "submitted" || status === "reviewed") return "submitted";
  return "completed";
}

/** HR-controlled windows: when false, that phase is locked for employees/managers. */
export type ReviewWindowSettings = {
  /** Employee can submit KPIs (beginning of year). */
  kpiSubmissionOpen: boolean;
  /** Mid-year ratings + manager comments. */
  midYearReviewOpen: boolean;
  /** Annual self-ratings + manager annual ratings. */
  annualReviewOpen: boolean;
};

export const DEFAULT_REVIEW_WINDOWS: ReviewWindowSettings = {
  kpiSubmissionOpen: true,
  midYearReviewOpen: false,
  annualReviewOpen: false,
};

/** Matches form column “Goals | KPIs”. */
export type KpiRow = {
  goalsAndKpis: string;
  /** Whole percent, e.g. 40 for 40%; KPI rows should sum to 100. */
  weightPercent: number;
  dueDate: string;
  /** Unset until employee selects a rating (required before submit). */
  selfRating: number | null;
  managerRating: number | null;
  managerComments: string;
  /** Mid-Year checkpoint — employee self-assessment (On Track / Not on Track). */
  midYearRating: MidYearRating | null;
  /** Mid-Year manager comment against this KPI. */
  midYearComment: string;
};

export type CapabilityId =
  | "planning"
  | "leadership"
  | "financial_management"
  | "strategic_execution"
  | "communication";

export type CapabilityRow = {
  id: CapabilityId;
  selfRating: number | null;
  managerRating: number | null;
  managerComments: string;
  /**
   * Mid-Year capability rating — optional (1–5). Not mandatory at mid-year.
   * Scale: Does not meet / Needs improvement / Meets / Exceeds / Outstanding.
   */
  midYearRating: number | null;
  /** Mid-Year manager comment on this capability (optional). */
  midYearComment: string;
};

export type Appraisal = {
  id: string;
  /** Links this appraisal to a demo login user (`MockUser.id`). */
  ownerUserId: string;
  /**
   * Demo: manager login id that receives in-app review notifications when the
   * employee submits. Null when the line manager has no demo account (e.g. Mark → David).
   */
  reviewingManagerId: string | null;
  employeeName: string;
  /** Full name in English (HR / directory). */
  englishName: string;
  position: string;
  department: string;
  /** M level 1–10 — drives Appendix 1 capability descriptions. */
  mLevel: number;
  managerName: string;
  entity: string;
  status: AppraisalStatus;
  /** Mid-Year checkpoint status (independent of the annual workflow). */
  midYearStatus: CycleStatus;
  /** Overall Mid-Year manager comment (shown in Annual review too). */
  midYearManagerComments: string;
  kpis: KpiRow[];
  capabilities: CapabilityRow[];
  employeeComments: string;
  /** Populated at manager review. */
  managerComments: string;
  /**
   * Optional manager override of the calculated overall (1–5).
   * When set, shown as the final manager overall rating to employee and HR.
   */
  managerOverallOverride: number | null;
};

export const MIN_KPIS = 3;
export const MAX_KPIS = 6;

export const CAPABILITY_ORDER: CapabilityId[] = [
  "planning",
  "leadership",
  "financial_management",
  "strategic_execution",
  "communication",
];

export const ENTITY_OPTIONS = [
  "AFE",
  "HQ Corporate Services",
  "China Campus",
  "VN & Health",
  "ADSC",
] as const;
