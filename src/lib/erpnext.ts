/**
 * ERPNext integration: mirror local appraisal actions into ERPNext (dev
 * site) via `aemg_epm_frappe.api.appraisal.*`, one narrow, proven slice at
 * a time. See erpnext-integration-status memory / project docs for the
 * running list of what's wired vs still local-only.
 *
 * Everything here authenticates as a single shared service account
 * (`epm-integration@aemg.demo`, roles: HR Manager/HR User/Employee/System
 * Manager) - there is no per-user login yet on either side. That has a real
 * consequence for which ERPNext endpoints we can call at all:
 *
 *   - Manager/HR-side endpoints (`approve_kpis`, `complete_mid_year`,
 *     `submit_annual_manager`, `complete_appraisal`, ...) gate on
 *     `_require_manager`, which HR roles bypass - epm-integration qualifies,
 *     so these ARE safely callable for any employee's appraisal.
 *   - Employee-side endpoints (`update_kpis`, `submit_kpis`,
 *     `update_mid_year_ratings`, `submit_annual_self`, ...) gate on
 *     `_require_self` (`doc.employee != current_employee(session user)`),
 *     which has NO HR bypass. epm-integration has no linked Employee record,
 *     so these calls fail for every employee. Wiring the employee-facing
 *     half of the cycle requires resolving the shared-account-vs-real-
 *     identity decision first (see memory) - not attempted here.
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
 * POST to a whitelisted `aemg_epm_frappe.api.appraisal.*` method as the
 * shared service account. Never throws - returns null on any failure
 * (network, timeout, non-2xx, or an ERPNext-side frappe.throw), after
 * logging the reason. Callers just check for null.
 */
async function erpnextMethodCall<T = Record<string, unknown>>(
  method: string,
  payload: Record<string, unknown>
): Promise<T | null> {
  if (!erpnextConfigured()) return null;
  try {
    const res = await fetch(
      `${process.env.ERPNEXT_URL}/api/method/aemg_epm_frappe.api.appraisal.${method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: erpnextAuthHeader(),
        },
        body: JSON.stringify(payload),
        // Best-effort only - do not let a slow/unreachable dev server hang
        // the local action this is mirroring.
        signal: AbortSignal.timeout(8000),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      message?: T;
      exception?: string;
    };
    if (!res.ok || body.message == null) {
      console.error(
        `[erpnext] ${method} failed:`,
        res.status,
        body.exception ?? body
      );
      return null;
    }
    return body.message;
  } catch (e) {
    console.error(`[erpnext] ${method} failed:`, e);
    return null;
  }
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
async function findErpnextAppraisalName(ownerUserId: string): Promise<string | null> {
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
