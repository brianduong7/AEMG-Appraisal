export type AppraisalStatus =
  | "draft"
  | "submitted"
  | "reviewed"
  /** Manager finalized and sent to HR; record is locked. */
  | "completed";

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
  kpis: KpiRow[];
  capabilities: CapabilityRow[];
  employeeComments: string;
  /** Populated at manager review. */
  managerComments: string;
};

export const MAX_KPIS = 5;

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
