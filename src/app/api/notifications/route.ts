import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActor } from "@/lib/appraisal-actor";
import { readsFromErpnext } from "@/lib/appraisal-source";
import { erpnextApiCall } from "@/lib/erpnext";
import { listNotificationsForManager } from "@/lib/notification-store";
import { DEMO_HR, DEMO_MANAGER } from "@/lib/mock-users";

/**
 * This only ever accepted the hardcoded demo manager id, so it 400'd for
 * every real SSO manager/HR user in production - the notification bell
 * silently showed "no pending notifications" for everyone instead of
 * surfacing the failed fetch. Fixed 2026-08-17.
 *
 * That fix only special-cased DEMO_MANAGER.id ("mark"), missing DEMO_HR.id
 * ("hr") - so the demo HR account's own notification fetch started 400ing
 * too (demo mode has no server session for the auth() fallback to check
 * against). Fixed alongside the notification-scoping pass, 2026-08-19.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const managerId = searchParams.get("managerId")?.trim() ?? "";
  if (!managerId) {
    return NextResponse.json({ error: "Invalid managerId" }, { status: 400 });
  }

  /**
   * Under ERPNext these are DERIVED, not stored.
   *
   * The local store had to be appended to on submit and swept on approve,
   * and every bug it produced was the same shape: the table disagreeing with
   * the appraisals it described - notifications attributed to the wrong
   * manager, ones surviving the approval that should have cleared them, ones
   * addressed to accounts nobody had signed into. None of that is reachable
   * when "waiting on me" is a question asked of current state rather than an
   * event that had to be recorded correctly and then cleaned up correctly.
   *
   * It also means the answer is scoped by ERPNext to the acting manager, so
   * the old `?managerId=` - which the caller supplied and which therefore
   * had to be checked against the session - stops being load-bearing.
   */
  if (readsFromErpnext()) {
    const actor = await resolveActor(searchParams.get("as") ?? managerId);
    if (!actor) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const res = await erpnextApiCall<
      {
        appraisalId: string;
        employeeName: string;
        kind: string;
        label: string;
        since: string;
      }[]
    >("appraisal_read.pending_reviews", {}, undefined, actor.employee);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 502 });
    }
    return NextResponse.json(
      (res.data ?? []).map((r) => ({
        id: `${r.appraisalId}:${r.kind}`,
        appraisalId: r.appraisalId,
        managerUserId: managerId,
        employeeName: r.employeeName,
        createdAt: r.since,
      }))
    );
  }

  if (managerId !== DEMO_MANAGER.id && managerId !== DEMO_HR.id) {
    // Real (SSO) caller: only ever allowed to read their OWN notifications,
    // never someone else's - checked against the server-verified session,
    // not anything the client could spoof in the query string.
    const session = await auth();
    if (session?.identity?.employee !== managerId) {
      return NextResponse.json({ error: "Invalid managerId" }, { status: 400 });
    }
  }

  const items = await listNotificationsForManager(managerId);
  return NextResponse.json(items);
}
