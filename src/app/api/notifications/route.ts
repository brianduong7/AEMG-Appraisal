import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listNotificationsForManager } from "@/lib/notification-store";
import { DEMO_MANAGER } from "@/lib/mock-users";

/**
 * This only ever accepted the hardcoded demo manager id, so it 400'd for
 * every real SSO manager/HR user in production - the notification bell
 * silently showed "no pending notifications" for everyone instead of
 * surfacing the failed fetch. Fixed 2026-08-17.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const managerId = searchParams.get("managerId")?.trim() ?? "";
  if (!managerId) {
    return NextResponse.json({ error: "Invalid managerId" }, { status: 400 });
  }

  if (managerId !== DEMO_MANAGER.id) {
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
