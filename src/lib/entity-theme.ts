import type { Appraisal } from "./types";
import { findMockUser, type MockUser } from "./mock-users";

export type SessionModeForDisplay = "employee" | "manager" | "hr";

/**
 * List row label: prefer directory profile over stored `employeeName`, which can
 * lag (e.g. old seed "John") until the next save.
 */
export function appraisalListDisplayName(
  a: Appraisal,
  mode: SessionModeForDisplay,
  user: MockUser | null
): string {
  if (mode === "employee" && user && a.ownerUserId === user.id) {
    return user.employeeName;
  }
  const fromDirectory = findMockUser(a.ownerUserId);
  if (fromDirectory) return fromDirectory.employeeName;
  return a.employeeName || "Appraisal";
}

/**
 * Subtle page tint + top accent per entity (readable in light & dark).
 * Prefer this over a loud full-screen color — keeps focus on the form.
 */
export function entityShellClass(entity: string | null | undefined): string {
  const e = entity?.trim() ?? "";
  const base =
    "min-h-full flex-1 bg-gradient-to-b transition-[background] duration-300";
  const map: Record<string, string> = {
    AFE: `${base} from-amber-50 via-zinc-50 to-zinc-100 border-t-4 border-amber-500/60 dark:from-amber-950/40 dark:via-zinc-950 dark:to-zinc-950 dark:border-amber-500/35`,
    "HQ Corporate Services": `${base} from-slate-100 via-zinc-50 to-zinc-100 border-t-4 border-slate-500/50 dark:from-slate-900/50 dark:via-zinc-950 dark:to-zinc-950 dark:border-sky-500/35`,
    "China Campus": `${base} from-red-50 via-zinc-50 to-zinc-100 border-t-4 border-red-400/45 dark:from-red-950/35 dark:via-zinc-950 dark:to-zinc-950 dark:border-red-500/30`,
    "VN & Health": `${base} from-teal-50 via-zinc-50 to-zinc-100 border-t-4 border-teal-500/50 dark:from-teal-950/35 dark:via-zinc-950 dark:to-zinc-950 dark:border-teal-400/30`,
    ADSC: `${base} from-violet-50 via-zinc-50 to-zinc-100 border-t-4 border-violet-500/50 dark:from-violet-950/40 dark:via-zinc-950 dark:to-zinc-950 dark:border-violet-400/35`,
  };
  return (
    map[e] ??
    `${base} from-zinc-50 to-zinc-100 border-t-4 border-zinc-300/60 dark:from-zinc-950 dark:to-zinc-950 dark:border-zinc-600/40`
  );
}
