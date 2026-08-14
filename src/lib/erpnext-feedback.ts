/**
 * Third-party feedback requests: the "send someone a link, they leave a
 * comment on this appraisal" feature, backed by
 * `aemg_epm_frappe.api.feedback` on the ERPNext add-on.
 *
 * UNLIKE everything in erpnext.ts, this is not a mirror. Those functions
 * copy a local JSON-store write into ERPNext as a best-effort side effect,
 * and swallow failures because the local record is already the source of
 * truth. Here ERPNext IS the only store - there is no local feedback
 * table - so every function below reports failure to the caller instead of
 * silently returning null. A manager who thinks they generated a working
 * link, but didn't, is a worse outcome than an honest error message.
 *
 * The practical consequence: if ERPNext is unreachable, this feature is
 * unavailable rather than degraded. That's the deliberate trade for having
 * one authoritative home for a token that outside reviewers hold.
 *
 * Everything here authenticates as the shared `epm-integration` service
 * account, including the two token endpoints. The reviewer never talks to
 * ERPNext - they hit a page on this app, and this app makes the call. See
 * api/feedback.py's module docstring for why that boundary matters.
 */

import { erpnextApiCall, findErpnextAppraisalName, type ErpnextResult } from "./erpnext";

/** One request against an appraisal, answered or not. */
export type FeedbackRequest = {
  name: string;
  reviewerName: string;
  reviewerRole: string | null;
  reviewerBranch: string | null;
  requestedByName: string | null;
  status: "Pending" | "Submitted";
  comment: string | null;
  submittedOn: string | null;
  createdAt: string;
};

/**
 * What a reviewer holding a link is allowed to see. Deliberately narrow -
 * no ratings, no scores, no other reviewers' comments (enforced server
 * side in get_feedback_request, not just here).
 */
export type FeedbackRequestContext = {
  alreadySubmitted: boolean;
  reviewerName: string;
  reviewerRole: string | null;
  reviewerBranch: string | null;
  requestedByName: string | null;
  employeeName: string | null;
  position: string | null;
  department: string | null;
  appraisalCycle: string | null;
};

type RawFeedbackRequest = {
  name: string;
  reviewer_name: string;
  reviewer_role: string | null;
  reviewer_branch: string | null;
  requested_by_name: string | null;
  status: string;
  comment: string | null;
  submitted_on: string | null;
  creation: string;
};

function mapRequest(raw: RawFeedbackRequest): FeedbackRequest {
  return {
    name: raw.name,
    reviewerName: raw.reviewer_name,
    reviewerRole: raw.reviewer_role,
    reviewerBranch: raw.reviewer_branch,
    requestedByName: raw.requested_by_name,
    status: raw.status === "Submitted" ? "Submitted" : "Pending",
    comment: raw.comment,
    submittedOn: raw.submitted_on,
    createdAt: raw.creation,
  };
}

/**
 * Resolve a local demo login to its ERPNext Appraisal, or an error the
 * caller can show. Split out because "this appraisal was never mirrored
 * into ERPNext" is a genuinely different problem from "ERPNext rejected
 * the call", and the fix for it is different too.
 */
async function requireErpnextAppraisal(
  ownerUserId: string,
  cycleYear: number
): Promise<ErpnextResult<string>> {
  const appraisal = await findErpnextAppraisalName(ownerUserId, cycleYear);
  if (!appraisal) {
    return {
      ok: false,
      error:
        "This appraisal does not exist in ERPNext yet, so feedback cannot be requested against it.",
    };
  }
  return { ok: true, data: appraisal };
}

/** Manager or HR: create a request and get back its link token. */
export async function createFeedbackRequest(
  ownerUserId: string,
  input: {
    reviewerName: string;
    reviewerRole?: string;
    reviewerBranch?: string;
    requestedByName?: string;
  },
  cycleYear: number
): Promise<ErpnextResult<{ name: string; token: string }>> {
  const appraisal = await requireErpnextAppraisal(ownerUserId, cycleYear);
  if (!appraisal.ok) return appraisal;

  return erpnextApiCall<{ name: string; token: string }>(
    "feedback.create_feedback_request",
    {
      appraisal: appraisal.data,
      reviewer_name: input.reviewerName,
      reviewer_role: input.reviewerRole ?? undefined,
      reviewer_branch: input.reviewerBranch ?? undefined,
      requested_by_name: input.requestedByName ?? undefined,
    }
  );
}

/** Manager or HR: every request against this appraisal, newest first. */
export async function listFeedbackRequests(
  ownerUserId: string,
  cycleYear: number
): Promise<ErpnextResult<FeedbackRequest[]>> {
  const appraisal = await requireErpnextAppraisal(ownerUserId, cycleYear);
  if (!appraisal.ok) return appraisal;

  const result = await erpnextApiCall<RawFeedbackRequest[]>(
    "feedback.list_feedback_requests",
    { appraisal: appraisal.data }
  );
  if (!result.ok) return result;
  return { ok: true, data: (result.data ?? []).map(mapRequest) };
}

/** Manager or HR: revoke a request. Also deletes its answer, if any. */
export async function deleteFeedbackRequest(
  name: string
): Promise<ErpnextResult<{ deleted: string }>> {
  return erpnextApiCall<{ deleted: string }>("feedback.delete_feedback_request", {
    name,
  });
}

/**
 * Reviewer side: resolve a link token into the form's context.
 *
 * Returns ok:false with a neutral message for an unknown OR deleted token -
 * the server does not distinguish them and neither should the page, so a
 * stale link can't be used to probe which requests exist.
 */
export async function getFeedbackRequestByToken(
  token: string
): Promise<ErpnextResult<FeedbackRequestContext>> {
  const result = await erpnextApiCall<{
    found: boolean;
    already_submitted?: boolean;
    reviewer_name?: string;
    reviewer_role?: string | null;
    reviewer_branch?: string | null;
    requested_by_name?: string | null;
    employee_name?: string | null;
    position?: string | null;
    department?: string | null;
    appraisal_cycle?: string | null;
  }>("feedback.get_feedback_request", { token });

  if (!result.ok) return result;
  if (!result.data?.found) {
    return { ok: false, error: "This feedback link is not valid." };
  }

  const d = result.data;
  return {
    ok: true,
    data: {
      alreadySubmitted: Boolean(d.already_submitted),
      reviewerName: d.reviewer_name ?? "",
      reviewerRole: d.reviewer_role ?? null,
      reviewerBranch: d.reviewer_branch ?? null,
      requestedByName: d.requested_by_name ?? null,
      employeeName: d.employee_name ?? null,
      position: d.position ?? null,
      department: d.department ?? null,
      appraisalCycle: d.appraisal_cycle ?? null,
    },
  };
}

/** Reviewer side: record the answer. One per link - see api/feedback.py. */
export async function submitFeedbackResponse(
  token: string,
  comment: string
): Promise<ErpnextResult<{ name: string; status: string }>> {
  return erpnextApiCall<{ name: string; status: string }>(
    "feedback.submit_feedback_response",
    { token, comment }
  );
}
