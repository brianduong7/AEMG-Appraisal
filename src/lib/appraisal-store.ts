import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Appraisal, CapabilityRow, KpiRow } from "./types";
import { CAPABILITY_ORDER, ENTITY_OPTIONS, MAX_KPIS } from "./types";
import { migrateAppraisal } from "./migrate-appraisal";
import {
  employmentProfileFromUser,
  findMockUser,
  reviewingManagerIdForOwner,
} from "./mock-users";
import { buildDemoSubmittedEmmaForMark } from "./demo-appraisal-seed";
import {
  addReviewPendingNotification,
  removeNotificationsForAppraisal,
} from "./notification-store";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "appraisals.json");

/**
 * Default: in-memory only (no disk writes — safe for serverless / read-only hosts).
 * Optional local persistence: run with APPRAISAL_STORE=file (writes under /data).
 */
const USE_MEMORY_STORE = process.env.APPRAISAL_STORE !== "file";

let memoryAppraisals: Appraisal[] | null = null;

function getMemoryAppraisals(): Appraisal[] {
  if (!memoryAppraisals) {
    memoryAppraisals = [];
  }
  return memoryAppraisals;
}

function defaultCapabilities(): CapabilityRow[] {
  return CAPABILITY_ORDER.map((id) => ({
    id,
    selfRating: 3,
    managerRating: null,
    managerComments: "",
  }));
}

async function ensureFile(): Promise<Appraisal[]> {
  if (USE_MEMORY_STORE) {
    return getMemoryAppraisals();
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      const empty: Appraisal[] = [];
      await fs.writeFile(DATA_FILE, JSON.stringify(empty, null, 2), "utf-8");
      return empty;
    }
    if (parsed.length === 0) {
      return [];
    }
    return parsed.map((item) => migrateAppraisal(item));
  } catch {
    const empty: Appraisal[] = [];
    await fs.writeFile(DATA_FILE, JSON.stringify(empty, null, 2), "utf-8");
    return empty;
  }
}

/**
 * Demo: exactly one appraisal row per `ownerUserId`. Last row in list order wins;
 * others are removed and their notifications cleared.
 */
async function enforceOneAppraisalPerOwner(list: Appraisal[]): Promise<{
  next: Appraisal[];
  changed: boolean;
}> {
  const chosen = new Map<string, Appraisal>();
  for (const a of list) {
    chosen.set(a.ownerUserId, a);
  }
  const keepIds = new Set([...chosen.values()].map((x) => x.id));
  const dropped = list.filter((a) => !keepIds.has(a.id));
  for (const a of dropped) {
    await removeNotificationsForAppraisal(a.id);
  }

  const ordered: Appraisal[] = [];
  const seenOwner = new Set<string>();
  for (const a of list) {
    const pick = chosen.get(a.ownerUserId)!;
    if (a.id !== pick.id || seenOwner.has(a.ownerUserId)) continue;
    ordered.push(a);
    seenOwner.add(a.ownerUserId);
  }

  const changed = ordered.length !== list.length;
  return { next: ordered, changed };
}

async function applyAppraisalListPolicy(
  list: Appraisal[]
): Promise<{ next: Appraisal[]; changed: boolean }> {
  return enforceOneAppraisalPerOwner(list);
}

async function ensureDemoSubmittedEmmaForMark(
  list: Appraisal[]
): Promise<Appraisal[]> {
  if (process.env.DISABLE_DEMO_APPRAISAL_SEED === "1") {
    return list;
  }
  if (list.some((a) => a.ownerUserId === "emma")) {
    return list;
  }
  const demo = buildDemoSubmittedEmmaForMark();
  list.push(demo);
  await writeAppraisals(list);
  if (demo.reviewingManagerId) {
    await addReviewPendingNotification({
      appraisalId: demo.id,
      managerUserId: demo.reviewingManagerId,
      employeeName: demo.employeeName,
    });
  }
  return list;
}

export async function readAppraisals(): Promise<Appraisal[]> {
  let list = await ensureFile();
  list = await ensureDemoSubmittedEmmaForMark(list);
  const { next, changed } = await applyAppraisalListPolicy(list);
  if (changed) {
    await writeAppraisals(next);
    return next;
  }
  return list;
}

export async function getAppraisal(id: string): Promise<Appraisal | null> {
  const list = await readAppraisals();
  return list.find((a) => a.id === id) ?? null;
}

export async function writeAppraisals(appraisals: Appraisal[]): Promise<void> {
  if (USE_MEMORY_STORE) {
    memoryAppraisals = appraisals;
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(appraisals, null, 2), "utf-8");
}

/** Creates a draft appraisal for a demo employee (Emma / Mark / …). */
export async function createAppraisal(ownerUserId: string): Promise<Appraisal> {
  const user = findMockUser(ownerUserId);
  if (!user) {
    throw new Error("Unknown employee");
  }
  const list = await readAppraisals();
  const id = randomUUID();
  const profile = employmentProfileFromUser(user);
  const reviewingManagerId = reviewingManagerIdForOwner(ownerUserId);
  const raw = {
    id,
    ownerUserId,
    reviewingManagerId,
    ...profile,
    status: "draft" as const,
    kpis: [
      {
        goalsAndKpis: "",
        weightPercent: 100,
        dueDate: "",
        selfRating: 3,
        managerRating: null,
        managerComments: "",
      },
    ],
    capabilities: defaultCapabilities(),
    employeeComments: "",
    managerComments: "",
  };
  const appraisal = migrateAppraisal(raw);
  const withNew = [...list, appraisal];
  await writeAppraisals(withNew);
  const { next, changed } = await applyAppraisalListPolicy(withNew);
  if (changed) {
    await writeAppraisals(next);
  }
  const finalList = changed ? next : withNew;
  return finalList.find((a) => a.id === id) ?? appraisal;
}

function clampKpis(kpis: KpiRow[]): KpiRow[] {
  return kpis.slice(0, MAX_KPIS).map((k) => ({
    ...k,
    weightPercent: Math.min(100, Math.max(0, Number(k.weightPercent) || 0)),
    selfRating: Math.min(5, Math.max(1, Number(k.selfRating) || 3)),
    managerRating:
      k.managerRating == null
        ? null
        : Math.min(5, Math.max(1, Number(k.managerRating) || 3)),
  }));
}

function clampCapabilities(rows: CapabilityRow[]): CapabilityRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return CAPABILITY_ORDER.map((id) => {
    const r = byId.get(id);
    return {
      id,
      selfRating: Math.min(5, Math.max(1, Number(r?.selfRating) || 3)),
      managerRating:
        r?.managerRating == null
          ? null
          : Math.min(5, Math.max(1, Number(r.managerRating) || 3)),
      managerComments: String(r?.managerComments ?? ""),
    };
  });
}

export async function updateAppraisal(
  id: string,
  updater: (current: Appraisal) => Appraisal | null
): Promise<Appraisal | null> {
  const list = await readAppraisals();
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  const next = updater(list[idx]);
  if (!next) return null;
  next.kpis = clampKpis(next.kpis);
  next.capabilities = clampCapabilities(next.capabilities);
  list[idx] = next;
  await writeAppraisals(list);
  const { next: normalized, changed } = await applyAppraisalListPolicy(list);
  if (changed) {
    await writeAppraisals(normalized);
    const updated = normalized.find((a) => a.id === id);
    return updated ?? next;
  }
  return next;
}
