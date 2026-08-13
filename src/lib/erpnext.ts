/**
 * ERPNext integration: mirror local appraisal actions into ERPNext (dev
 * site) via `aemg_epm_frappe.api.appraisal.*`, one narrow, proven slice at
 * a time. See erpnext-integration-status memory / project docs for the
 * running list of what's wired vs still local-only.
 *
 * There is still no real per-user login on either side - the Next.js app's
 * "logged in" user is one of four fixed demo logins (emma/mark/john/hr).
 * What changed in this slice is WHICH ERPNext identity each mirror call
 * authenticates as, because ERPNext's own endpoints split cleanly into two
 * groups by what they gate on:
 *
 *   - Manager/HR-side endpoints (`approve_kpis`, `complete_mid_year`,
 *     `submit_annual_manager`, `complete_appraisal`, `hr_override_appraisal`,
 *     ...) gate on `_require_manager` / HR-only, which the shared
 *     `epm-integration@aemg.demo` service account satisfies (it holds HR
 *     Manager/HR User/System Manager roles) - these keep using that one
 *     shared account, via `erpnextAuthHeader()`.
 *   - Employee-side endpoints (`update_kpis`, `submit_kpis`,
 *     `update_mid_year_ratings`, `submit_annual_self`,
 *     `update_capability_self_ratings`, ...) gate on `_require_self`
 *     (`doc.employee != current_employee(session user)`), which has NO HR
 *     bypass - epm-integration can never pass it for someone else's
 *     appraisal. These now authenticate as that demo user's OWN ERPNext
 *     credentials instead, via `ownerAuthHeader(ownerUserId)` - each of the
 *     four demo Users on aemg-dev.local already had a linked Employee
 *     record (from dev_seed.py) and the plain "Employee" role; they just
 *     needed their own api_key/api_secret generated, which now live in
 *     `.env.local` as `ERPNEXT_API_KEY_<NAME>` / `ERPNEXT_API_SECRET_<NAME>`.
 *     This is still not real login - it's real ERPNext identity bolted onto
 *     the existing fixed demo-login list. A future real-login flow would
 *     replace `ownerAuthHeader`'s fixed lookup with something derived from
 *     the actual signed-in user, not the four hardcoded demo credentials.
 *
 * All mirror calls are best-effort: logged, never thrown, and never allowed
 * to block or break the local JSON-store demo flow if ERPNext is
 * unreachable or rejects the call.
 */

// Matches home-content.tsx's erpAppraisalCycleLabel() - ERPNext's seeded
// Appraisal Cycle is literally named "2026 Annual Appraisal".
function erpAppraisalCycleLabel(year: number): string {
  return `${year} Annual Appraisal`;
}

/**
 * Demo login id -> ERPNext Employee id, for the accounts seeded on
 * aemg-dev.local specifically to mirror the prototype's demo roster.
 * David (skip-level) has no demo login, so isn't included.
 */
const ERPNEXT_EMPLOYEE_ID: Record<string, string> = {
  emma: "HR-EMP-00004",
  mark: "HR-EMP-00002",
  john: "HR-EMP-00005",
  hr: "HR-EMP-00003",
};

export function erpnextEmployeeIdForOwner(ownerUserId: string): string | null {
  // A Microsoft-authenticated user has no demo roster entry - their session
  // id IS their ERPNext Employee id (see mockUserFromIdentity), so it needs
  // no translation. The map above stays for the four demo logins, whose ids
  // are names rather than doc ids.
  if (/^HR-EMP-\d+$/.test(ownerUserId)) return ownerUserId;
  return ERPNEXT_EMPLOYEE_ID[ownerUserId] ?? null;
}

/**
 * Local `CapabilityId` -> ERPNext `Employee Feedback Criteria` display name.
 * Matches `CAPABILITY_ORDER` in types.ts against the criteria seeded on
 * aemg-dev.local (confirmed by hand via a direct Appraisal read).
 */
const CAPABILITY_CRITERIA_LABEL: Record<string, string> = {
  planning: "Planning",
  leadership: "Leadership",
  financial_management: "Financial Management",
  strategic_execution: "Strategic Execution",
  communication: "Communication",
};

/** Local `MidYearRating` -> ERPNext's goal-row `aemg_mid_year_rating` Select. */
function erpMidYearRating(raw: string | null): string {
  if (raw === "on_track") return "On Track";
  if (raw === "not_on_track") return "Not on Track";
  // "early_access" has no ERPNext equivalent (not modeled on that side) -
  // and null is simply unset. Both map to the field's own empty default.
  return "";
}

/**
 * Local `midYearStatus` (a single cycle-status enum: not_started ->
 * kpi_created -> kpi_approved -> draft -> submitted -> completed) split
 * into ERPNext's two separate fields. This split is exact - unlike the
 * local `status` field (see hr-override docstring), `midYearStatus` and
 * this pair genuinely encode the same concept.
 */
function erpKpiAndMidYearStatus(midYearStatus: string): {
  aemg_kpi_status: string;
  aemg_mid_year_status: string;
} {
  switch (midYearStatus) {
    case "kpi_created":
      return { aemg_kpi_status: "KPI Created", aemg_mid_year_status: "Not Started" };
    case "kpi_approved":
      return { aemg_kpi_status: "KPI Approved", aemg_mid_year_status: "Not Started" };
    case "draft":
      return { aemg_kpi_status: "KPI Approved", aemg_mid_year_status: "Draft" };
    case "submitted":
      return { aemg_kpi_status: "KPI Approved", aemg_mid_year_status: "Submitted" };
    case "completed":
      return { aemg_kpi_status: "KPI Approved", aemg_mid_year_status: "Completed" };
    default:
      return { aemg_kpi_status: "Not Started", aemg_mid_year_status: "Not Started" };
  }
}

function erpnextConfigured(): boolean {
  return Boolean(
    process.env.ERPNEXT_URL &&
      process.env.ERPNEXT_API_KEY &&
      process.env.ERPNEXT_API_SECRET
  );
}

function erpnextAuthHeader(): string {
  return `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`;
}

/**
 * Per-demo-user ERPNext credentials, for the employee-self endpoints only
 * (see module docstring). Each demo login's own `key:secret`, from a
 * dedicated env var pair - not derivable from ERPNEXT_EMPLOYEE_ID, since
 * that's an Employee id (a doc name) and this is a User's API credential.
 */
const OWNER_CREDENTIAL_ENV_SUFFIX: Record<string, string> = {
  emma: "EMMA",
  mark: "MARK",
  john: "JOHN",
  hr: "HR",
};

function ownerAuthHeader(ownerUserId: string): string | null {
  const suffix = OWNER_CREDENTIAL_ENV_SUFFIX[ownerUserId];
  if (!suffix) return null;
  const key = process.env[`ERPNEXT_API_KEY_${suffix}`];
  const secret = process.env[`ERPNEXT_API_SECRET_${suffix}`];
  if (!key || !secret) return null;
  return `token ${key}:${secret}`;
}

export type ErpnextResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * POST to any whitelisted `aemg_epm_frappe.api.*` method, by its dotted
 * path below that prefix (e.g. "appraisal.approve_kpis",
 * "feedback.create_feedback_request").
 *
 * Never throws. Returns a result rather than null so callers that have no
 * local fallback - the feedback feature in erpnext-feedback.ts, where
 * ERPNext is the only store - can show the real reason instead of failing
 * silently. The mirror functions in this file don't need that and use the
 * thinner `erpnextMethodCall` wrapper below.
 *
 * `authHeader` picks which identity this call authenticates as:
 * `erpnextAuthHeader()` (the shared epm-integration account, for
 * manager/HR-gated endpoints) or `ownerAuthHeader(ownerUserId)` (that
 * employee's own credentials, required for `_require_self`-gated
 * endpoints) - see module docstring.
 */
export async function erpnextApiCall<T = Record<string, unknown>>(
  dottedMethod: string,
  payload: Record<string, unknown>,
  authHeader: string = erpnextAuthHeader()
): Promise<ErpnextResult<T>> {
  if (!erpnextConfigured()) {
    return { ok: false, error: "ERPNext is not configured." };
  }
  try {
    const res = await fetch(
      `${process.env.ERPNEXT_URL}/api/method/aemg_epm_frappe.api.${dottedMethod}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
        // Do not let a slow/unreachable dev server hang the local action.
        signal: AbortSignal.timeout(8000),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      message?: T;
      exception?: string;
    };
    if (!res.ok || body.message == null) {
      const error = erpnextExceptionMessage(body.exception) ?? `ERPNext returned ${res.status}.`;
      console.error(
        `[erpnext] ${dottedMethod} failed:`,
        res.status,
        body.exception ?? body
      );
      return { ok: false, error };
    }
    return { ok: true, data: body.message };
  } catch (e) {
    console.error(`[erpnext] ${dottedMethod} failed:`, e);
    return { ok: false, error: "Could not reach ERPNext." };
  }
}

/**
 * Frappe reports a `frappe.throw` as an exception string like
 * "frappe.exceptions.ValidationError: Reviewer name is required." - the
 * part after the last ": " is the human-readable message we raised
 * server-side. Returns null when there's nothing useful to show, so the
 * caller falls back to a generic message rather than surfacing a bare
 * Python traceback class to a user.
 */
function erpnextExceptionMessage(exception: string | undefined): string | null {
  if (!exception) return null;
  const idx = exception.lastIndexOf(": ");
  const message = idx === -1 ? exception : exception.slice(idx + 2);
  const trimmed = message.trim();
  return trimmed && !trimmed.includes("Traceback") ? trimmed : null;
}

/**
 * Best-effort wrapper over `erpnextApiCall` for the appraisal mirrors in
 * this file: null on any failure, reason already logged. Every mirror here
 * is a side effect on top of a local write that already succeeded, so
 * there is nothing useful for the caller to do with the error text.
 */
async function erpnextMethodCall<T = Record<string, unknown>>(
  method: string,
  payload: Record<string, unknown>,
  authHeader: string = erpnextAuthHeader()
): Promise<T | null> {
  const result = await erpnextApiCall<T>(`appraisal.${method}`, payload, authHeader);
  return result.ok ? result.data : null;
}

/**
 * Best-effort mirror of a new appraisal into ERPNext. Returns the created
 * ERPNext Appraisal's `name` (doc id) on success, for logging/verification,
 * or null if skipped/failed.
 */
export async function mirrorAppraisalCreateToErpnext(
  ownerUserId: string
): Promise<string | null> {
  const employee = erpnextEmployeeIdForOwner(ownerUserId);
  if (!employee) return null;

  const appraisalCycle = erpAppraisalCycleLabel(new Date().getFullYear());
  const result = await erpnextMethodCall<{ name: string }>("create_appraisal", {
    appraisal_cycle: appraisalCycle,
    employee,
  });
  if (!result?.name) return null;
  console.log(`[erpnext] mirrored appraisal for ${ownerUserId} -> ${result.name}`);
  return result.name;
}

/**
 * Look up the ERPNext Appraisal `name` for this owner's current-year cycle.
 * We don't persist the ERPNext doc id on the local record (no schema change
 * for this slice), so every mirror call re-resolves it by employee + cycle.
 * Returns null if unconfigured, unmapped, unreachable, or genuinely not
 * found (e.g. the create-appraisal mirror failed or hasn't run yet).
 */
export async function findErpnextAppraisalName(ownerUserId: string): Promise<string | null> {
  if (!erpnextConfigured()) return null;
  const employee = erpnextEmployeeIdForOwner(ownerUserId);
  if (!employee) return null;

  const appraisalCycle = erpAppraisalCycleLabel(new Date().getFullYear());
  const filters = encodeURIComponent(
    JSON.stringify([
      ["employee", "=", employee],
      ["appraisal_cycle", "=", appraisalCycle],
    ])
  );
  const fields = encodeURIComponent(JSON.stringify(["name"]));

  try {
    const res = await fetch(
      `${process.env.ERPNEXT_URL}/api/resource/Appraisal?filters=${filters}&fields=${fields}&order_by=creation desc&limit_page_length=1`,
      {
        headers: { Authorization: erpnextAuthHeader() },
        signal: AbortSignal.timeout(8000),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: { name: string }[];
      exception?: string;
    };
    if (!res.ok || !body.data?.length) {
      if (!res.ok) {
        console.error("[erpnext] find appraisal failed:", res.status, body.exception ?? body);
      }
      return null;
    }
    return body.data[0]!.name;
  } catch (e) {
    console.error("[erpnext] find appraisal failed:", e);
    return null;
  }
}

/**
 * Mirror the manager's KPI approval (local `manager_kpi_approve`) into
 * ERPNext via `approve_kpis`. Manager/HR-side, so it's safely callable
 * under the shared service account - see module docstring. Best-effort:
 * returns true only when ERPNext genuinely transitioned to KPI Approved.
 */
export async function mirrorKpiApproveToErpnext(ownerUserId: string): Promise<boolean> {
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const result = await erpnextMethodCall<{ aemg_kpi_status: string }>("approve_kpis", {
    appraisal,
  });
  const ok = result?.aemg_kpi_status === "KPI Approved";
  if (ok) {
    console.log(`[erpnext] mirrored KPI approve for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror the manager's mid-year completion (local `manager_midyear_submit`)
 * into ERPNext via `complete_mid_year`. Manager/HR-side, so it's safely
 * callable under the shared service account - see module docstring.
 * Best-effort: returns true only when ERPNext genuinely transitioned to
 * Completed.
 */
export async function mirrorMidYearCompleteToErpnext(
  ownerUserId: string,
  managerComments: string
): Promise<boolean> {
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const result = await erpnextMethodCall<{ aemg_mid_year_status: string }>(
    "complete_mid_year",
    { appraisal, manager_comments: managerComments }
  );
  const ok = result?.aemg_mid_year_status === "Completed";
  if (ok) {
    console.log(`[erpnext] mirrored mid-year complete for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror the manager's annual review submit (local `manager_submit`) into
 * ERPNext: writes goal + capability manager ratings, then finalizes via
 * `submit_annual_manager`. Manager/HR-side, safely callable under the
 * shared service account - see module docstring.
 *
 * Requires ERPNext's `aemg_annual_status` to already be "Submitted" (i.e.
 * the employee's own `submit_annual_self` already ran there) - same
 * employee-side prerequisite gap as the mid-year slice. Goal rows are
 * matched by position (`idx` 1-based, in local `kpis` order) since we don't
 * persist ERPNext's own row ids locally.
 */
export async function mirrorAnnualManagerSubmitToErpnext(
  ownerUserId: string,
  kpis: { managerRating: number | null }[],
  capabilities: { id: string; managerRating: number | null }[]
): Promise<boolean> {
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const goalRatings = kpis.map((k, i) => ({ idx: i + 1, score: k.managerRating }));
  await erpnextMethodCall("update_annual_manager_ratings", { appraisal, ratings: goalRatings });

  const capRatings = capabilities
    .map((c) => {
      const criteria = CAPABILITY_CRITERIA_LABEL[c.id];
      return criteria ? { criteria, aemg_manager_rating: c.managerRating } : null;
    })
    .filter((r): r is { criteria: string; aemg_manager_rating: number | null } => r != null);
  if (capRatings.length > 0) {
    await erpnextMethodCall("update_capability_manager_ratings", {
      appraisal,
      ratings: capRatings,
    });
  }

  const result = await erpnextMethodCall<{ aemg_annual_status: string }>(
    "submit_annual_manager",
    { appraisal }
  );
  const ok = result?.aemg_annual_status === "Reviewed";
  if (ok) {
    console.log(`[erpnext] mirrored annual manager submit for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror the manager's final sign-off (local `manager_complete`) into
 * ERPNext via `complete_appraisal`, submitting the ERPNext doc (docstatus
 * 0 -> 1). Manager/HR-side, safely callable under the shared service
 * account - see module docstring. Requires ERPNext's `aemg_annual_status`
 * to already be "Reviewed" (i.e. `submit_annual_manager` already ran).
 */
export async function mirrorAppraisalCompleteToErpnext(
  ownerUserId: string,
  managerOverallOverride: number | null
): Promise<boolean> {
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const result = await erpnextMethodCall<{ aemg_annual_status: string }>(
    "complete_appraisal",
    {
      appraisal,
      manager_overall_override: managerOverallOverride ?? undefined,
    }
  );
  const ok = result?.aemg_annual_status === "Completed";
  if (ok) {
    console.log(`[erpnext] mirrored appraisal complete for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror HR's admin override (local `hr_update`) into ERPNext via the
 * dedicated `hr_override_appraisal` endpoint (AEMG-EPM-Frappe branch
 * `epm-workflow-logic`, not yet on `main`) - the only endpoint in that
 * module that skips the phase/window state machine, matching hr_update's
 * own "HR can fix anything, any time" contract. Always sends the full
 * current record (not just the changed fields) - simpler than tracking
 * which fields the HR payload actually touched, and idempotent either way.
 *
 * Deliberately does NOT send the local `status` field - see
 * hr_override_appraisal's docstring for why that would silently corrupt
 * `aemg_annual_status` (the two encode different phases, not the same
 * concept). `midYearStatus` IS sent, split into ERPNext's two fields via
 * `erpKpiAndMidYearStatus` - that split is a safe 1:1 translation.
 */
export async function mirrorHrUpdateToErpnext(
  ownerUserId: string,
  fields: {
    kpis: {
      goalsAndKpis: string;
      weightPercent: number;
      dueDate: string;
      selfRating: number | null;
      managerRating: number | null;
      midYearRating: string | null;
    }[];
    capabilities: {
      id: string;
      selfRating: number | null;
      managerRating: number | null;
      midYearRating: number | null;
      midYearComment: string;
    }[];
    employeeComments: string;
    managerComments: string;
    midYearManagerComments: string;
    midYearStatus: string;
    managerOverallOverride: number | null;
  }
): Promise<boolean> {
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const goals = fields.kpis.map((k) => ({
    kra: k.goalsAndKpis,
    per_weightage: k.weightPercent,
    aemg_due_date: k.dueDate || null,
    aemg_self_score: k.selfRating,
    score: k.managerRating,
    aemg_mid_year_rating: erpMidYearRating(k.midYearRating),
  }));

  const capabilities = fields.capabilities
    .map((c) => {
      const criteria = CAPABILITY_CRITERIA_LABEL[c.id];
      if (!criteria) return null;
      return {
        criteria,
        rating: c.selfRating,
        aemg_manager_rating: c.managerRating,
        aemg_mid_year_rating: c.midYearRating,
        aemg_mid_year_comment: c.midYearComment,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const { aemg_kpi_status, aemg_mid_year_status } = erpKpiAndMidYearStatus(
    fields.midYearStatus
  );

  const result = await erpnextMethodCall<{ name: string }>("hr_override_appraisal", {
    appraisal,
    data: {
      goals,
      capabilities,
      aemg_kpi_status,
      aemg_mid_year_status,
      aemg_mid_year_manager_comments: fields.midYearManagerComments,
      aemg_manager_overall_override: fields.managerOverallOverride,
      reflections: fields.employeeComments,
      remarks: fields.managerComments,
    },
  });
  const ok = result?.name === appraisal;
  if (ok) {
    console.log(`[erpnext] mirrored HR override for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror the employee's initial KPI submission (local `employee_submit`)
 * into ERPNext: writes the goal rows via `update_kpis`, then finalizes with
 * `submit_kpis`. Employee-self, so - unlike every mirror above - this
 * authenticates as that employee's own ERPNext credentials, not the shared
 * service account; see module docstring. Best-effort: returns true only
 * when ERPNext genuinely transitioned to KPI Created.
 */
export async function mirrorKpiSubmitToErpnext(
  ownerUserId: string,
  kpis: { goalsAndKpis: string; weightPercent: number; dueDate: string }[]
): Promise<boolean> {
  const auth = ownerAuthHeader(ownerUserId);
  if (!auth) return false;
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const goals = kpis.map((k) => ({
    kra: k.goalsAndKpis,
    per_weightage: k.weightPercent,
    aemg_due_date: k.dueDate || null,
  }));
  await erpnextMethodCall("update_kpis", { appraisal, goals }, auth);

  const result = await erpnextMethodCall<{ aemg_kpi_status: string }>(
    "submit_kpis",
    { appraisal },
    auth
  );
  const ok = result?.aemg_kpi_status === "KPI Created";
  if (ok) {
    console.log(`[erpnext] mirrored KPI submit for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror the employee's mid-year submit (local `employee_midyear_submit`)
 * into ERPNext: writes each goal's On Track / Not on Track rating via
 * `update_mid_year_ratings`, then finalizes with
 * `submit_mid_year_employee`. Employee-self - see module docstring. Goal
 * rows matched by position (`idx` 1-based, in local `kpis` order), same as
 * the manager-side annual mirror. Only the rating is sent, not a comment -
 * per-KPI mid-year comments are manager-owned in the prototype (see
 * normalizeKpisFromEmployee's own note) and are mirrored separately via
 * `mirrorMidYearCompleteToErpnext`.
 */
export async function mirrorMidYearEmployeeSubmitToErpnext(
  ownerUserId: string,
  kpis: { midYearRating: string | null }[]
): Promise<boolean> {
  const auth = ownerAuthHeader(ownerUserId);
  if (!auth) return false;
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const ratings = kpis.map((k, i) => ({
    idx: i + 1,
    aemg_mid_year_rating: erpMidYearRating(k.midYearRating),
  }));
  await erpnextMethodCall("update_mid_year_ratings", { appraisal, ratings }, auth);

  const result = await erpnextMethodCall<{ aemg_mid_year_status: string }>(
    "submit_mid_year_employee",
    { appraisal },
    auth
  );
  const ok = result?.aemg_mid_year_status === "Submitted";
  if (ok) {
    console.log(`[erpnext] mirrored employee mid-year submit for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}

/**
 * Mirror the employee's annual self-review submit (local
 * `employee_annual_submit`) into ERPNext: writes goal self-scores
 * (`update_annual_self_ratings`) and capability self-ratings
 * (`update_capability_self_ratings`), then finalizes with
 * `submit_annual_self`. Employee-self - see module docstring. Goal rows
 * matched by position, capability rows by the local `CapabilityId` ->
 * ERPNext criteria-label map (same one the manager-side mirror uses).
 */
export async function mirrorAnnualSelfSubmitToErpnext(
  ownerUserId: string,
  kpis: { selfRating: number | null }[],
  capabilities: { id: string; selfRating: number | null }[]
): Promise<boolean> {
  const auth = ownerAuthHeader(ownerUserId);
  if (!auth) return false;
  const appraisal = await findErpnextAppraisalName(ownerUserId);
  if (!appraisal) return false;

  const goalRatings = kpis.map((k, i) => ({ idx: i + 1, aemg_self_score: k.selfRating }));
  await erpnextMethodCall(
    "update_annual_self_ratings",
    { appraisal, ratings: goalRatings },
    auth
  );

  const capRatings = capabilities
    .map((c) => {
      const criteria = CAPABILITY_CRITERIA_LABEL[c.id];
      return criteria ? { criteria, rating: c.selfRating } : null;
    })
    .filter((r): r is { criteria: string; rating: number | null } => r != null);
  if (capRatings.length > 0) {
    await erpnextMethodCall(
      "update_capability_self_ratings",
      { appraisal, ratings: capRatings },
      auth
    );
  }

  const result = await erpnextMethodCall<{ aemg_annual_status: string }>(
    "submit_annual_self",
    { appraisal },
    auth
  );
  const ok = result?.aemg_annual_status === "Submitted";
  if (ok) {
    console.log(`[erpnext] mirrored annual self submit for ${ownerUserId} -> ${appraisal}`);
  }
  return ok;
}
