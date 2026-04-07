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
    id: "1",
    employeeName: "Emma Nguyen",
    position: "Senior Analyst",
    department: "Corporate Finance",
    mLevel: 4,
    managerName: "David Park",
    entity: "HQ Corporate Services",
  },
  {
    id: "2",
    employeeName: "Marcus Lee",
    position: "Coordinator",
    department: "Operations",
    mLevel: 3,
    managerName: "Priya Shah",
    entity: "China Campus",
  },
];

export type EmploymentProfile = Pick<
  Appraisal,
  "employeeName" | "position" | "department" | "mLevel" | "managerName" | "entity"
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
