import type { Appraisal } from "@/lib/types";

const PREFIX = "aemg-appraisal-bootstrap:";

export function saveAppraisalBootstrap(appraisal: Appraisal): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + appraisal.id, JSON.stringify(appraisal));
  } catch {
    /* quota / private mode */
  }
}

export function readAppraisalBootstrap(id: string): Appraisal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + id);
    if (!raw) return null;
    return JSON.parse(raw) as Appraisal;
  } catch {
    return null;
  }
}
