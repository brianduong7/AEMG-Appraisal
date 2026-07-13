import type { Appraisal } from "./types";

export type MockUser = {
  id: string;
  /** Preferred display / short name — prefer englishName for formal fields. */
  employeeName: string;
  englishName: string;
  position: string;
  department: string;
  mLevel: number;
  /** Full name of the line manager. */
  managerName: string;
  entity: string;
};

/** Demo directory — matches appraisal `ownerUserId`. */
export const MOCK_USERS: MockUser[] = [
  {
    id: "emma",
    employeeName: "Emma Thompson",
    englishName: "Emma Thompson",
    position: "Senior Analyst",
    department: "Corporate Finance",
    mLevel: 4,
    managerName: "Mark Stevenson",
    entity: "HQ Corporate Services",
  },
  {
    id: "mark",
    employeeName: "Mark Stevenson",
    englishName: "Mark Stevenson",
    position: "Department Manager",
    department: "Operations",
    mLevel: 6,
    managerName: "David Park",
    entity: "HQ Corporate Services",
  },
  {
    id: "john",
    employeeName: "John Lee",
    englishName: "John Lee",
    position: "Financial Analyst",
    department: "Corporate Finance",
    mLevel: 3,
    managerName: "Mark Stevenson",
    entity: "AFE",
  },
  {
    id: "hr",
    employeeName: "HR Manager",
    englishName: "HR Manager",
    position: "HR Business Partner",
    department: "People & Culture",
    mLevel: 5,
    managerName: "David Park",
    entity: "HQ Corporate Services",
  },
];

/** Shown on Overview and create preview — not stored on appraisal row. */
export const DEMO_COMPANY_NAME = "AEMG EDUCATION";

/** Single demo manager login — reviews reports whose appraisals name them as reviewer. */
export const DEMO_MANAGER = {
  id: "mark",
  displayName: "Mark Stevenson",
} as const;

/** Demo HR login — sees appraisals after the manager completes and sends to HR. */
export const DEMO_HR = {
  id: "hr",
  displayName: "HR Manager",
} as const;

/**
 * Demo skip-level (one above direct manager). Used for completion notifications.
 * Sam to confirm production hierarchy.
 */
export const DEMO_SKIP_LEVEL_MANAGER = {
  id: "david",
  displayName: "David Park",
  role: "Department Director",
} as const;

export type EmploymentProfile = Pick<
  Appraisal,
  | "employeeName"
  | "englishName"
  | "position"
  | "department"
  | "mLevel"
  | "managerName"
  | "entity"
>;

export function employmentProfileFromUser(u: MockUser): EmploymentProfile {
  return {
    employeeName: u.englishName || u.employeeName,
    englishName: u.englishName,
    position: u.position,
    department: u.department,
    mLevel: u.mLevel,
    managerName: u.managerName,
    entity: u.entity,
  };
}

export function findMockUser(id: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

/**
 * When a new appraisal is created for `ownerUserId`, which manager login (if any)
 * should get an in-app notification on submit.
 */
export function reviewingManagerIdForOwner(ownerUserId: string): string | null {
  if (ownerUserId === "emma" || ownerUserId === "john") return DEMO_MANAGER.id;
  if (ownerUserId === "mark") return null;
  if (ownerUserId === "hr") return null;
  const u = findMockUser(ownerUserId);
  if (!u) return null;
  if (u.managerName.toLowerCase().includes("mark")) return DEMO_MANAGER.id;
  return null;
}

/**
 * Overview / display: prefer HR directory when `ownerUserId` matches a demo user,
 * so manager view and stored rows stay fully prefilled even if JSON lagged.
 */
export function overviewProfileForAppraisal(
  ownerUserId: string,
  fallback: EmploymentProfile
): EmploymentProfile {
  const dir = findMockUser(ownerUserId);
  if (dir) return employmentProfileFromUser(dir);
  return {
    ...fallback,
    employeeName: fallback.englishName || fallback.employeeName,
    managerName: fallback.managerName,
  };
}

/** Formal full name for list / overview Employee field. */
export function displayEmployeeFullName(
  a: Pick<Appraisal, "englishName" | "employeeName" | "ownerUserId">
): string {
  const dir = findMockUser(a.ownerUserId);
  if (dir) return dir.englishName || dir.employeeName;
  return a.englishName?.trim() || a.employeeName?.trim() || "—";
}
