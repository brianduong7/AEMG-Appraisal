/**
 * Turn a Microsoft-authenticated email into an AEMG employee identity, by
 * asking `aemg_epm_frappe.api.identity.resolve_user` on the ERPNext add-on.
 *
 * The split of responsibility is deliberate: Microsoft answers "is this
 * person who they say they are", ERPNext answers "and are they an employee
 * we run appraisals for, with what role". Passing Entra is not enough to
 * get in - see the add-on's docstring on why an AEMG mailbox alone isn't
 * authorisation.
 *
 * Uses the shared `epm-integration` service account, like every other
 * manager/HR-side call. That is fine here: this is a read, and it happens
 * before we know who the user is, so there is no per-user identity to act
 * as yet.
 */

import { erpnextApiCall } from "./erpnext";

export type ErpnextIdentity = {
  /** ERPNext Employee doc id, e.g. "HR-EMP-00006". */
  employee: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  /** Linked ERPNext User email, when one exists. Often absent. */
  userId: string | null;
  reportsTo: string | null;
  managerName: string | null;
  company: string | null;
  mLevel: number | null;
  entity: string | null;
  /** Somebody actively reports to them (live org chart, not a snapshot). */
  isManager: boolean;
  /** Their linked ERPNext User holds an HR role. */
  isHr: boolean;
};

type RawIdentity = {
  found: boolean;
  employee?: string;
  employee_name?: string;
  designation?: string | null;
  department?: string | null;
  user_id?: string | null;
  reports_to?: string | null;
  manager_name?: string | null;
  company?: string | null;
  m_level?: number | null;
  entity?: string | null;
  is_manager?: boolean;
  is_hr?: boolean;
};

/**
 * Returns null when the email maps to no active employee - the caller MUST
 * treat that as "refuse the login", not as a degraded session. Also returns
 * null if ERPNext is unreachable: failing closed is the only safe direction
 * for an authorisation check, even though it means an ERPNext outage blocks
 * sign-in entirely.
 */
export async function resolveErpnextIdentity(
  email: string | null | undefined
): Promise<ErpnextIdentity | null> {
  const trimmed = (email ?? "").trim();
  if (!trimmed) return null;

  const result = await erpnextApiCall<RawIdentity>("identity.resolve_user", {
    email: trimmed,
  });
  if (!result.ok) {
    console.error("[auth] identity lookup failed:", result.error);
    return null;
  }
  const d = result.data;
  if (!d?.found || !d.employee) return null;

  return {
    employee: d.employee,
    employeeName: d.employee_name ?? trimmed,
    designation: d.designation ?? null,
    department: d.department ?? null,
    userId: d.user_id ?? null,
    reportsTo: d.reports_to ?? null,
    managerName: d.manager_name ?? null,
    company: d.company ?? null,
    mLevel: typeof d.m_level === "number" ? d.m_level : null,
    entity: d.entity ?? null,
    isManager: Boolean(d.is_manager),
    isHr: Boolean(d.is_hr),
  };
}
