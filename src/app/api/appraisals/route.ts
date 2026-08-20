import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAppraisal } from "@/lib/appraisal-store";
import { resolveActor } from "@/lib/appraisal-actor";
import {
  listForActor,
  readsFromErpnext,
  statusForError,
  writesToErpnext,
} from "@/lib/appraisal-source";
import { createErpnextAppraisal } from "@/lib/appraisal-writer";
import { getAppraisal as getFromErpnext } from "@/lib/appraisal-repo";
import { getReviewWindows } from "@/lib/settings-store";
import type { AppraisalScope } from "@/lib/appraisal-repo";
import { DEMO_COMPANY_NAME, findMockUser } from "@/lib/mock-users";

/** The nav's view names, as ERPNext scopes. */
function scopeFor(view: string | null): AppraisalScope {
  if (view === "team") return "team";
  if (view === "admin") return "org";
  return "self";
}

/**
 * List the appraisals this caller may see.
 *
 * This used to return EVERY appraisal in the store to anyone who asked and
 * let the client filter for display. With demo seed data that was untidy;
 * with ERPNext behind it, it would hand the whole company's appraisals to
 * any signed-in employee. The scope now travels with the request and is
 * enforced server-side in ERPNext against the acting identity, so a caller
 * asking for a scope they do not hold is refused rather than quietly given
 * a narrower list they might present as complete.
 *
 * `as` names a demo login and is honoured only where demo logins are
 * enabled (dev); production ignores it entirely.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const actor = await resolveActor(searchParams.get("as"));
  const scope = scopeFor(searchParams.get("view"));

  if (readsFromErpnext() && !actor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const appraisals = await listForActor(actor, scope, {
      includeChildren: true,
    });
    return NextResponse.json(appraisals);
  } catch (e) {
    // Under ERPNext this is a real outage or a refused scope, not something
    // to paper over with an empty list - an empty list reads as "you have no
    // appraisals", which is a different and much more alarming statement.
    const msg = e instanceof Error ? e.message : "Could not load appraisals.";
    return NextResponse.json({ error: msg }, { status: statusForError(e) });
  }
}

/**
 * Create an appraisal for `ownerUserId`.
 *
 * Two populations, and the difference matters for trust:
 *
 *   - A demo login is a key into the hardcoded roster, and its employment
 *     details come from there.
 *   - A Microsoft-authenticated user has no roster entry. Their details are
 *     read from the SERVER-SIDE session (resolved from ERPNext at sign-in),
 *     never from the request body - otherwise a caller could post any job
 *     title, M level, or reporting line they liked and have it written onto
 *     a real appraisal.
 *
 * An SSO user may only create their own appraisal. Managers and HR creating
 * on someone else's behalf still works through the demo roster, but is not
 * yet available to SSO users: it needs an ERPNext lookup by employee id
 * (rather than by email) plus a decision about who is allowed to do it for
 * whom, which is deliberately out of scope here.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const ownerUserId = String(
    (body as { ownerUserId?: unknown }).ownerUserId ?? ""
  ).trim();
  if (!ownerUserId) {
    return NextResponse.json({ error: "Invalid ownerUserId" }, { status: 400 });
  }

  const session = await auth();
  const identity = session?.identity;

  /**
   * ERPNext create. The employment details are ERPNext's own - it reads them
   * off the Employee record - so unlike the local path there is nothing to
   * copy across from the session, and nothing a caller could spoof by
   * posting a different job title or reporting line.
   */
  if (writesToErpnext()) {
    const actor = await resolveActor(
      new URL(request.url).searchParams.get("as") ?? ownerUserId
    );
    if (!actor) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    try {
      const windows = await getReviewWindows();
      const name = await createErpnextAppraisal(actor, windows.currentCycleYear);
      const created = await getFromErpnext(actor, name);
      if (!created) {
        return NextResponse.json(
          { error: "Created, but could not read it back." },
          { status: 502 }
        );
      }
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      return NextResponse.json({ error: msg }, { status: statusForError(e) });
    }
  }

  if (identity && identity.employee === ownerUserId) {
    try {
      const appraisal = await createAppraisal(ownerUserId, {
        profile: {
          employeeName: identity.employeeName,
          englishName: identity.employeeName,
          position: identity.designation ?? "",
          department: identity.department ?? "",
          mLevel: identity.mLevel ?? 3,
          managerName: identity.managerName ?? "",
          entity: identity.entity ?? "",
          company: identity.company ?? DEMO_COMPANY_NAME,
        },
        // Their real line manager from ERPNext, as an Employee id - the same
        // shape the manager-side team filter compares against, so an SSO
        // manager sees their reports without any roster involvement.
        reviewingManagerId: identity.reportsTo,
      });
      return NextResponse.json(appraisal, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Create failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (!findMockUser(ownerUserId)) {
    return NextResponse.json({ error: "Invalid ownerUserId" }, { status: 400 });
  }
  try {
    const appraisal = await createAppraisal(ownerUserId);
    return NextResponse.json(appraisal, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
