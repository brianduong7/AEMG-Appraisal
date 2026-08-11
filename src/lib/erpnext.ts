/**
 * First real slice of the ERPNext integration: mirror a newly-created
 * appraisal into ERPNext (dev site) via `aemg_epm_frappe.api.appraisal.
 * create_appraisal`, so we can prove the wiring actually works end to end.
 *
 * Deliberately NOT a full swap-over yet. The rest of the app (KPI submit,
 * approve, mid-year, annual, HR admin) still reads/writes the local JSON
 * store - ERPNext's response shape doesn't match the prototype's `Appraisal`
 * type, and translating that is its own follow-up piece of work, not done
 * here. This call is a side effect: best-effort, logged, never blocks or
 * breaks the local demo flow if ERPNext is unreachable.
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

function erpnextConfigured(): boolean {
  return Boolean(
    process.env.ERPNEXT_URL &&
      process.env.ERPNEXT_API_KEY &&
      process.env.ERPNEXT_API_SECRET
  );
}

/**
 * Best-effort mirror of a new appraisal into ERPNext. Never throws - a
 * failure here must not break the local demo flow. Returns the created
 * ERPNext Appraisal's `name` (doc id) on success, for logging/verification,
 * or null if skipped/failed.
 */
export async function mirrorAppraisalCreateToErpnext(
  ownerUserId: string
): Promise<string | null> {
  if (!erpnextConfigured()) return null;

  const employee = erpnextEmployeeIdForOwner(ownerUserId);
  if (!employee) return null;

  const cycleYear = new Date().getFullYear();
  const appraisalCycle = erpAppraisalCycleLabel(cycleYear);

  try {
    const res = await fetch(
      `${process.env.ERPNEXT_URL}/api/method/aemg_epm_frappe.api.appraisal.create_appraisal`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `token ${process.env.ERPNEXT_API_KEY}:${process.env.ERPNEXT_API_SECRET}`,
        },
        body: JSON.stringify({ appraisal_cycle: appraisalCycle, employee }),
        // Best-effort only - do not let a slow/unreachable dev server hang
        // the demo's create flow.
        signal: AbortSignal.timeout(8000),
      }
    );
    const body = (await res.json().catch(() => ({}))) as {
      message?: { name?: string };
      exception?: string;
    };
    if (!res.ok || !body.message?.name) {
      console.error(
        "[erpnext] create_appraisal mirror failed:",
        res.status,
        body.exception ?? body
      );
      return null;
    }
    console.log(
      `[erpnext] mirrored appraisal for ${ownerUserId} -> ${body.message.name}`
    );
    return body.message.name;
  } catch (e) {
    console.error("[erpnext] create_appraisal mirror failed:", e);
    return null;
  }
}
