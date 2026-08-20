/**
 * Review windows and the current cycle, from ERPNext or the local store.
 *
 * The windows already existed on Appraisal Cycle and api/appraisal.py
 * already enforced them there - the app just kept its own second copy in a
 * JSON file and set that instead. Two copies of "is the mid-year window
 * open" is one more than can ever be trusted: the app could show a phase as
 * open while ERPNext refused every write to it, which is precisely the kind
 * of disagreement that reads to a user as the app being broken.
 *
 * Same switch as the appraisal store so the two cut over together.
 */

import * as local from "@/lib/settings-store";
import { erpnextApiCall } from "@/lib/erpnext";
import { readsFromErpnext, writesToErpnext } from "@/lib/appraisal-source";
import {
  ErpnextConflictError,
  ErpnextForbiddenError,
  ErpnextUnavailableError,
  type Actor,
} from "@/lib/appraisal-repo";
import { DEFAULT_REVIEW_WINDOWS, type ReviewWindowSettings } from "@/lib/types";

/** Same refusal-vs-outage distinction the appraisal paths make. */
function raise(kind: string | undefined, message: string): never {
  if (kind === "PermissionError") throw new ErpnextForbiddenError(message);
  if (kind === "ValidationError") throw new ErpnextConflictError(message);
  throw new ErpnextUnavailableError(message);
}

type ErpWindows = {
  cycle: string;
  currentCycleYear: number | null;
  kpiSubmissionOpen: boolean;
  midYearReviewOpen: boolean;
  annualReviewOpen: boolean;
};

function fromErp(w: ErpWindows): ReviewWindowSettings {
  return {
    kpiSubmissionOpen: w.kpiSubmissionOpen,
    midYearReviewOpen: w.midYearReviewOpen,
    annualReviewOpen: w.annualReviewOpen,
    currentCycleYear:
      w.currentCycleYear ?? DEFAULT_REVIEW_WINDOWS.currentCycleYear,
  };
}

export async function getWindows(): Promise<ReviewWindowSettings> {
  if (!readsFromErpnext()) return local.getReviewWindows();
  const res = await erpnextApiCall<ErpWindows>("settings.get_review_windows", {});
  if (!res.ok) {
    // Windows gate what the UI lets people do. Falling back to defaults here
    // would silently declare every phase open, so prefer the last known
    // local values - wrong, but wrong in the direction that was already
    // configured rather than inventing permission.
    console.error("[settings] falling back to local windows:", res.error);
    return local.getReviewWindows();
  }
  return fromErp(res.data);
}

export async function setWindows(
  actor: Actor | null,
  patch: Partial<ReviewWindowSettings>
): Promise<ReviewWindowSettings> {
  if (!writesToErpnext() || !actor) return local.updateReviewWindows(patch);
  const res = await erpnextApiCall<ErpWindows>(
    "settings.update_review_windows",
    {
      kpiSubmissionOpen: patch.kpiSubmissionOpen,
      midYearReviewOpen: patch.midYearReviewOpen,
      annualReviewOpen: patch.annualReviewOpen,
    },
    undefined,
    actor.employee
  );
  if (!res.ok) raise(res.kind, res.error);
  return fromErp(res.data);
}

export async function advanceCycle(
  actor: Actor | null
): Promise<ReviewWindowSettings> {
  if (!writesToErpnext() || !actor) return local.startNewCycle();
  const res = await erpnextApiCall<ErpWindows>(
    "settings.start_next_cycle",
    {},
    undefined,
    actor.employee
  );
  if (!res.ok) raise(res.kind, res.error);
  return fromErp(res.data);
}
