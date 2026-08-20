import { auth } from "@/auth";
import { demoLoginsEnabled } from "@/lib/env";
import { erpnextEmployeeIdForOwner } from "@/lib/erpnext";
import { findMockUser, DEMO_HR, DEMO_MANAGER } from "@/lib/mock-users";
import type { Actor } from "@/lib/appraisal-repo";

/**
 * Who is making this request, as an ERPNext identity.
 *
 * The API routes previously took the caller's word for it - `GET
 * /api/appraisals` returned every appraisal in the org to anyone and let
 * the client filter, and POST read `ownerUserId` straight from the body.
 * That is survivable while the data is demo seed and the store is local; it
 * is a real data leak the moment ERPNext is authoritative and the list is
 * the whole company. So identity is resolved HERE, server-side, and every
 * read is scoped against it by ERPNext itself.
 *
 * Two populations:
 *   - Microsoft SSO: the server-verified session already carries the
 *     ERPNext employee id and the derived isHr/isManager flags.
 *   - Demo logins: no server session at all (they are localStorage-only),
 *     so the caller names which demo account it is and we translate that to
 *     the real ERPNext employee it maps to. Accepted ONLY where demo logins
 *     are enabled - which is dev; production has them off - so this cannot
 *     become an impersonation route in prod.
 */
export async function resolveActor(demoUserId?: string | null): Promise<Actor | null> {
  const session = await auth();
  const identity = session?.identity;
  if (identity?.employee) {
    return {
      employee: identity.employee,
      isHr: Boolean(identity.isHr),
      isManager: Boolean(identity.isManager),
    };
  }

  if (!demoUserId || !demoLoginsEnabled()) return null;

  // A demo "manager"/"hr" login is a role, not an employee, but each maps to
  // a seeded ERPNext employee that really does hold that position in the
  // dev org chart - so the same scoping rules apply to them unchanged.
  const employee = erpnextEmployeeIdForOwner(demoUserId);
  if (!employee || !findMockUser(demoUserId)) return null;

  return {
    employee,
    isHr: demoUserId === DEMO_HR.id,
    isManager: demoUserId === DEMO_MANAGER.id || demoUserId === DEMO_HR.id,
  };
}
