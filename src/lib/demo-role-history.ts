/**
 * Dummy previous-role history for demo (no DB).
 * Used on Overview when an employee changed roles mid-cycle.
 */

export type PreviousRoleRecord = {
  id: string;
  ownerUserId: string;
  position: string;
  department: string;
  entity: string;
  managerName: string;
  fromDate: string;
  toDate: string;
  performanceSummary: string;
};

export const DEMO_PREVIOUS_ROLES: PreviousRoleRecord[] = [
  {
    id: "role-emma-1",
    ownerUserId: "emma",
    position: "Financial Analyst",
    department: "Corporate Finance",
    entity: "HQ Corporate Services",
    managerName: "Mark Stevenson",
    fromDate: "2024-01-01",
    toDate: "2025-06-30",
    performanceSummary:
      "Met all KPIs in prior role. Promoted to Senior Analyst effective Jul 2025 — prior-role outcomes remain reportable for HR.",
  },
  {
    id: "role-john-1",
    ownerUserId: "john",
    position: "Junior Analyst",
    department: "Corporate Finance",
    entity: "AFE",
    managerName: "Mark Stevenson",
    fromDate: "2023-03-01",
    toDate: "2024-12-31",
    performanceSummary:
      "Solid first-year delivery. Role change into Financial Analyst for 2025–26 cycle.",
  },
];

export function previousRolesForOwner(
  ownerUserId: string
): PreviousRoleRecord[] {
  return DEMO_PREVIOUS_ROLES.filter((r) => r.ownerUserId === ownerUserId);
}
