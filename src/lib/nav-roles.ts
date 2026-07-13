import type { Appraisal } from "./types";
import {
  DEMO_MANAGER,
  MOCK_USERS,
  findMockUser,
  reviewingManagerIdForOwner,
  type MockUser,
} from "./mock-users";
export type SessionModeLike = "employee" | "manager" | "hr";

/** App list scopes under Appraisal (sidebar). */
export type AppraisalNavView = "my" | "team" | "admin";

export type NavCapability = {
  /** Lowest-level employee or anyone with a personal appraisal. */
  canMyAppraisal: boolean;
  /** Has direct reports (manager) or elevated org view (HR / Super Admin). */
  canMyTeam: boolean;
  /** HR / Super Admin org-wide list. */
  canSuperAdmin: boolean;
  /** Display role chip. */
  roleLabel: string;
};

/** Demo: who reports to Mark (direct reports only). */
export function directReportUserIds(managerId: string): string[] {
  return MOCK_USERS.filter(
    (u) => reviewingManagerIdForOwner(u.id) === managerId
  ).map((u) => u.id);
}

export function hasDirectReports(managerId: string): boolean {
  return directReportUserIds(managerId).length > 0;
}

/**
 * Role → sidebar options.
 * - Employee (no team): My Appraisal
 * - Manager (has team): My Appraisal + My Team
 * - HR / Super Admin: My Appraisal (themselves) + My Team + Super Admin
 */
export function navCapabilitiesForSession(
  mode: SessionModeLike | null,
  user: MockUser | null,
  managerId: string | null
): NavCapability {
  if (mode === "hr") {
    return {
      canMyAppraisal: true,
      canMyTeam: true,
      canSuperAdmin: true,
      roleLabel: "Super Admin · HR",
    };
  }
  if (mode === "manager" && managerId) {
    const reports = hasDirectReports(managerId);
    return {
      canMyAppraisal: true,
      canMyTeam: reports,
      canSuperAdmin: false,
      roleLabel: reports ? "Manager" : "Employee",
    };
  }
  if (mode === "employee" && user) {
    const asManagerId = user.id;
    const reports = hasDirectReports(asManagerId);
    return {
      canMyAppraisal: true,
      canMyTeam: reports,
      canSuperAdmin: false,
      roleLabel: reports ? "Manager" : "Employee",
    };
  }
  return {
    canMyAppraisal: false,
    canMyTeam: false,
    canSuperAdmin: false,
    roleLabel: "Guest",
  };
}

export function defaultAppraisalView(caps: NavCapability): AppraisalNavView {
  if (caps.canSuperAdmin) return "admin";
  if (caps.canMyTeam) return "team";
  return "my";
}

export function parseAppraisalView(
  raw: string | null,
  caps: NavCapability
): AppraisalNavView {
  if (raw === "my" && caps.canMyAppraisal) return "my";
  if (raw === "team" && caps.canMyTeam) return "team";
  if (raw === "admin" && caps.canSuperAdmin) return "admin";
  return defaultAppraisalView(caps);
}

/** Filter list rows for the active sidebar view (demo, no DB). */
export function filterAppraisalsForView(
  list: Appraisal[],
  view: AppraisalNavView,
  mode: SessionModeLike | null,
  user: MockUser | null,
  managerId: string | null
): Appraisal[] {
  if (view === "admin") {
    /* Super Admin: free open access — all records. */
    return list;
  }
  if (view === "my") {
    const ownerId =
      (mode === "manager" || mode === "hr") && managerId
        ? managerId
        : user?.id ?? null;
    if (!ownerId) return [];
    return list.filter((a) => a.ownerUserId === ownerId);
  }
  /* team — direct reports only */
  const mid =
    managerId ??
    (mode === "employee" && user && hasDirectReports(user.id) ? user.id : null) ??
    (mode === "hr" ? DEMO_MANAGER.id : null);
  if (mode === "hr") {
    /* HR “My Team” demo: show Mark’s direct-report set as a sample team view. */
    const ids = new Set(directReportUserIds(DEMO_MANAGER.id));
    return list.filter((a) => ids.has(a.ownerUserId));
  }
  if (!mid) return [];
  const ids = new Set(directReportUserIds(mid));
  return list.filter(
    (a) =>
      ids.has(a.ownerUserId) ||
      a.reviewingManagerId === mid
  );
}

export function viewTitle(view: AppraisalNavView): string {
  if (view === "my") return "My Appraisals";
  if (view === "team") return "My Team Appraisals";
  return "Super Admin";
}

export function viewSubtitle(view: AppraisalNavView): string {
  if (view === "my") {
    return "Your personal appraisal for this cycle.";
  }
  if (view === "team") {
    return "Direct reports only — mid-year checkpoints and annual reviews.";
  }
  return "Org-wide appraisal list (demo Super Admin / Super User). Free open access.";
}

/** Employees a manager may create appraisals for (direct reports). */
export function createOwnerOptions(
  mode: SessionModeLike | null,
  managerId: string | null,
  view: AppraisalNavView
): MockUser[] {
  if (view === "my") {
    if (mode === "manager" && managerId) {
      const self = findMockUser(managerId);
      return self ? [self] : [];
    }
    if (mode === "hr" && managerId) {
      const self = findMockUser(managerId);
      return self ? [self] : [];
    }
  }
  if (mode === "manager" && managerId) {
    const ids = new Set(directReportUserIds(managerId));
    return MOCK_USERS.filter((u) => ids.has(u.id));
  }
  if (mode === "hr" && view === "team") {
    const ids = new Set(directReportUserIds(DEMO_MANAGER.id));
    return MOCK_USERS.filter((u) => ids.has(u.id));
  }
  if (mode === "hr" && view === "admin") {
    return MOCK_USERS;
  }
  return MOCK_USERS;
}
