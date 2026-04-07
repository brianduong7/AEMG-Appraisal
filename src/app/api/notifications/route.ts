import { NextResponse } from "next/server";
import { listNotificationsForManager } from "@/lib/notification-store";
import { DEMO_MANAGER } from "@/lib/mock-users";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const managerId = searchParams.get("managerId")?.trim() ?? "";
  if (!managerId || managerId !== DEMO_MANAGER.id) {
    return NextResponse.json({ error: "Invalid managerId" }, { status: 400 });
  }
  const items = await listNotificationsForManager(managerId);
  return NextResponse.json(items);
}
