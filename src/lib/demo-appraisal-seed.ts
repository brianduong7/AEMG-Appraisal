import { migrateAppraisal } from "@/lib/migrate-appraisal";
import type { Appraisal } from "@/lib/types";
import { CAPABILITY_ORDER } from "@/lib/types";

/** Stable id so we only insert this demo row once per store. */
export const DEMO_EMMA_SUBMITTED_FOR_MARK_ID =
  "00000000-0000-4000-8000-0000000000e1";

/**
 * Pre-seeded appraisal: Emma (employee) has submitted; Mark (manager login) can
 * open it from the list or notifications and complete manager review.
 */
export function buildDemoSubmittedEmmaForMark(): Appraisal {
  const capabilities = CAPABILITY_ORDER.map((id) => ({
    id,
    selfRating: null as number | null,
    managerRating: null as number | null,
    managerComments: "",
    midYearRating: null as number | null,
    midYearComment: "",
  }));
  return migrateAppraisal({
    id: DEMO_EMMA_SUBMITTED_FOR_MARK_ID,
    ownerUserId: "emma",
    reviewingManagerId: "mark",
    employeeName: "Emma Thompson",
    englishName: "Emma Thompson",
    position: "Senior Analyst",
    department: "Corporate Finance",
    mLevel: 4,
    managerName: "Mark Stevenson",
    entity: "HQ Corporate Services",
    status: "submitted",
    midYearStatus: "kpi_created",
    kpis: [
      {
        goalsAndKpis:
          "Deliver Q3 close analytics pack and reconcile variance drivers with FP&A.",
        weightPercent: 40,
        dueDate: "2026-03-31",
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      },
      {
        goalsAndKpis:
          "Stand up monthly KPI dashboard for the finance leadership forum.",
        weightPercent: 35,
        dueDate: "2026-06-30",
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      },
      {
        goalsAndKpis:
          "Mentor junior analyst on modeling standards and review cycles.",
        weightPercent: 25,
        dueDate: "2026-12-31",
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      },
    ],
    capabilities,
    employeeComments:
      "Demo submission (pre-loaded): KPIs submitted — Mid-Year Status is KPI Created. Manager can Approve KPIs.",
    managerComments: "",
    managerOverallOverride: null,
  });
}

/** Stable id — HR login’s own personal appraisal (My Appraisal sidebar). */
export const DEMO_HR_PERSONAL_APPRAISAL_ID =
  "00000000-0000-4000-8000-0000000000h1";

/**
 * Pre-seeded draft appraisal owned by the HR demo login so Super Admin can
 * open “My Appraisal” as an employee for themselves.
 */
export function buildDemoHrPersonalAppraisal(): Appraisal {
  const capabilities = CAPABILITY_ORDER.map((id) => ({
    id,
    selfRating: null as number | null,
    managerRating: null as number | null,
    managerComments: "",
    midYearRating: null as number | null,
    midYearComment: "",
  }));
  return migrateAppraisal({
    id: DEMO_HR_PERSONAL_APPRAISAL_ID,
    ownerUserId: "hr",
    reviewingManagerId: null,
    employeeName: "HR Manager",
    englishName: "HR Manager",
    position: "HR Business Partner",
    department: "People & Culture",
    mLevel: 5,
    managerName: "David Park",
    entity: "HQ Corporate Services",
    status: "draft",
    midYearStatus: "not_started",
    kpis: [
      {
        goalsAndKpis:
          "Deliver group appraisal cycle communications and completion tracking for all entities.",
        weightPercent: 40,
        dueDate: "2026-09-15",
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      },
      {
        goalsAndKpis:
          "Partner with line managers on mid-year checkpoint readiness and calibration support.",
        weightPercent: 35,
        dueDate: "2026-09-30",
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      },
      {
        goalsAndKpis:
          "Maintain People & Culture policy updates and HR helpdesk SLAs for the appraisal window.",
        weightPercent: 25,
        dueDate: "2026-12-31",
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      },
    ],
    capabilities,
    employeeComments: "",
    managerComments: "",
    managerOverallOverride: null,
  });
}
