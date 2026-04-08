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
  const capabilities = CAPABILITY_ORDER.map((id, i) => ({
    id,
    selfRating: (3 + (i % 3)) as number,
    managerRating: null as number | null,
    managerComments: "",
  }));
  return migrateAppraisal({
    id: DEMO_EMMA_SUBMITTED_FOR_MARK_ID,
    ownerUserId: "emma",
    reviewingManagerId: "mark",
    employeeName: "Emma",
    position: "Senior Analyst",
    department: "Corporate Finance",
    mLevel: 4,
    managerName: "Mark",
    entity: "HQ Corporate Services",
    status: "submitted",
    kpis: [
      {
        goalsAndKpis:
          "Deliver Q3 close analytics pack and reconcile variance drivers with FP&A.",
        weightPercent: 40,
        dueDate: "2026-03-31",
        selfRating: 4,
        managerRating: null,
        managerComments: "",
      },
      {
        goalsAndKpis:
          "Stand up monthly KPI dashboard for the finance leadership forum.",
        weightPercent: 35,
        dueDate: "2026-06-30",
        selfRating: 4,
        managerRating: null,
        managerComments: "",
      },
      {
        goalsAndKpis:
          "Mentor junior analyst on modeling standards and review cycles.",
        weightPercent: 25,
        dueDate: "2026-12-31",
        selfRating: 3,
        managerRating: null,
        managerComments: "",
      },
    ],
    capabilities,
    employeeComments:
      "Demo submission (pre-loaded): please add your manager ratings and comments below.",
    managerComments: "",
  });
}
