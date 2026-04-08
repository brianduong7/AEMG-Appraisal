import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "notifications.json");

/**
 * Default: in-memory only (no disk writes). Use APPRAISAL_STORE=file with the
 * appraisal store for local JSON persistence.
 */
const USE_MEMORY_STORE = process.env.APPRAISAL_STORE !== "file";

export type ManagerReviewNotification = {
  id: string;
  appraisalId: string;
  managerUserId: string;
  employeeName: string;
  createdAt: string;
};

let memoryNotifications: ManagerReviewNotification[] | null = null;

function getMemoryNotifications(): ManagerReviewNotification[] {
  if (!memoryNotifications) {
    memoryNotifications = [];
  }
  return memoryNotifications;
}

async function readAll(): Promise<ManagerReviewNotification[]> {
  if (USE_MEMORY_STORE) {
    return getMemoryNotifications();
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNotification);
  } catch {
    return [];
  }
}

async function writeAll(items: ManagerReviewNotification[]): Promise<void> {
  if (USE_MEMORY_STORE) {
    memoryNotifications = items;
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

function isNotification(x: unknown): x is ManagerReviewNotification {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.appraisalId === "string" &&
    typeof o.managerUserId === "string" &&
    typeof o.employeeName === "string" &&
    typeof o.createdAt === "string"
  );
}

export async function listNotificationsForManager(
  managerUserId: string
): Promise<ManagerReviewNotification[]> {
  const all = await readAll();
  const mine = all.filter((n) => n.managerUserId === managerUserId);
  const byEmployee = new Map<string, ManagerReviewNotification>();
  for (const n of mine) {
    const prev = byEmployee.get(n.employeeName);
    if (!prev || n.createdAt > prev.createdAt) {
      byEmployee.set(n.employeeName, n);
    }
  }
  return [...byEmployee.values()].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export async function addReviewPendingNotification(input: {
  appraisalId: string;
  managerUserId: string;
  employeeName: string;
}): Promise<void> {
  const all = await readAll();
  const withoutSameEmployee = all.filter(
    (n) =>
      !(
        n.managerUserId === input.managerUserId &&
        n.employeeName === input.employeeName
      )
  );
  withoutSameEmployee.push({
    id: randomUUID(),
    appraisalId: input.appraisalId,
    managerUserId: input.managerUserId,
    employeeName: input.employeeName,
    createdAt: new Date().toISOString(),
  });
  await writeAll(withoutSameEmployee);
}

export async function removeNotificationsForAppraisal(
  appraisalId: string
): Promise<void> {
  const all = await readAll();
  const next = all.filter((n) => n.appraisalId !== appraisalId);
  if (next.length === all.length) return;
  await writeAll(next);
}
