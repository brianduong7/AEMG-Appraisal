import type { Appraisal } from "./types";

export type MockUser = {
  id: string;
  employeeName: string;
  position: string;
  department: string;
  mLevel: number;
  managerName: string;
  entity: string;
};

/** Demo directory — matches appraisal `ownerUserId`. */
export const MOCK_USERS: MockUser[] = [
  {
    id: "emma",
    employeeName: "Emma",
    position: "Senior Analyst",
    department: "Corporate Finance",
    mLevel: 4,
    managerName: "Mark",
    entity: "HQ Corporate Services",
  },
  {
    id: "mark",
    employeeName: "Mark",
    position: "Department Manager",
    department: "Operations",
    mLevel: 6,
    managerName: "David Park",
    entity: "HQ Corporate Services",
  },
];

/** Single demo manager login — reviews reports whose appraisals name them as reviewer. */
export const DEMO_MANAGER = {
  id: "mark",
  displayName: "Mark",
} as const;

export type EmploymentProfile = Pick<
  Appraisal,
  | "employeeName"
  | "position"
  | "department"
  | "mLevel"
  | "managerName"
  | "entity"
>;

export function employmentProfileFromUser(u: MockUser): EmploymentProfile {
  return {
    employeeName: u.employeeName,
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
  if (ownerUserId === "emma") return DEMO_MANAGER.id;
  if (ownerUserId === "mark") return null;
  const u = findMockUser(ownerUserId);
  if (!u) return null;
  if (u.managerName.toLowerCase().includes("mark")) return DEMO_MANAGER.id;
  return null;
}
