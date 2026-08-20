/**
 * Which store the app actually reads and writes: ERPNext, or the legacy
 * local store.
 *
 * The whole point of routing every call through one switch is that the
 * cutover is reversible by an environment variable rather than a revert.
 * Reads flip first and writes stay local, so a mapping problem shows up as
 * wrong data on screen while the authoritative copy is still intact and one
 * setting away. Writes flip second, and that step is the point of no return
 * for a given record - which is exactly why it should not share a switch
 * with the reads.
 *
 *   APPRAISAL_BACKEND unset | "local"    -> legacy local store (default)
 *   APPRAISAL_BACKEND = "erpnext-read"   -> read ERPNext, write local+mirror
 *   APPRAISAL_BACKEND = "erpnext"        -> ERPNext for both
 */

import * as local from "@/lib/appraisal-store";
import * as erp from "@/lib/appraisal-repo";
import type { Actor, AppraisalScope } from "@/lib/appraisal-repo";
import type { Appraisal } from "@/lib/types";

export type BackendMode = "local" | "erpnext-read" | "erpnext";

export function backendMode(): BackendMode {
  const raw = (process.env.APPRAISAL_BACKEND ?? "").trim();
  if (raw === "erpnext") return "erpnext";
  if (raw === "erpnext-read") return "erpnext-read";
  return "local";
}

export function readsFromErpnext(): boolean {
  return backendMode() !== "local";
}

export function writesToErpnext(): boolean {
  return backendMode() === "erpnext";
}

/**
 * The list a given actor is allowed to see.
 *
 * Under the local store this still returns everything and leaves filtering
 * to the caller, because that is what it has always done and changing both
 * the source and the scoping at once would make a regression impossible to
 * attribute. Under ERPNext the scope is enforced server-side, against the
 * acting identity - so "admin" for a non-HR caller is refused rather than
 * quietly narrowed.
 */
export async function listForActor(
  actor: Actor | null,
  scope: AppraisalScope,
  opts: { cycleYear?: number; includeChildren?: boolean } = {}
): Promise<Appraisal[]> {
  if (!readsFromErpnext() || !actor) return local.readAppraisals();
  return erp.listAppraisals(actor, scope, opts);
}

export async function getById(
  actor: Actor | null,
  id: string
): Promise<Appraisal | null> {
  if (!readsFromErpnext() || !actor) return local.getAppraisal(id);
  return erp.getAppraisal(actor, id);
}

export async function hasOtherActive(
  actor: Actor | null,
  ownerUserId: string,
  excludeId: string,
  cycleYear: number
): Promise<boolean> {
  if (!readsFromErpnext() || !actor) {
    return local.hasOtherActiveAppraisal(ownerUserId, excludeId, cycleYear);
  }
  return erp.hasActiveAppraisal(actor, {
    employee: actor.employee,
    cycleYear,
    excludeId,
  });
}

/**
 * HTTP status for an error out of the read/write layer.
 *
 * Everything used to become 502, which told a user their appraisal system
 * was broken when in fact they had simply asked for something not theirs.
 */
export function statusForError(e: unknown): number {
  if (e instanceof erp.ErpnextForbiddenError) return 403;
  if (e instanceof erp.ErpnextNotFoundError) return 404;
  // A phase-gate refusal ("KPI status must be 'Not Started' first") is the
  // request arriving against a state that has moved on - the same thing the
  // local path returned 409 for. Reporting it as 502 would tell the user
  // ERPNext was broken when it was working exactly as designed.
  if (e instanceof erp.ErpnextConflictError) return 409;
  return 502;
}
