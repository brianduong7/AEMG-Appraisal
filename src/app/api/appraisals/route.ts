import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAppraisal, readAppraisals } from "@/lib/appraisal-store";
import { DEMO_COMPANY_NAME, findMockUser } from "@/lib/mock-users";

export async function GET() {
  const appraisals = await readAppraisals();
  return NextResponse.json(appraisals);
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
