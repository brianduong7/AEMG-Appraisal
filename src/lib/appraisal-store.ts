import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Appraisal, CapabilityRow, KpiRow } from "./types";
import { CAPABILITY_ORDER, ENTITY_OPTIONS, MAX_KPIS, MIN_KPIS } from "./types";
import { migrateAppraisal } from "./migrate-appraisal";
import { buildDemoHrPersonalAppraisal, buildDemoSubmittedEmmaForMark } from "./demo-appraisal-seed";
import { buildDemoHrCompletedAppraisals } from "./demo-hr-seed";
import {
  DEMO_HR,
  employmentProfileFromUser,
  findMockUser,
  reviewingManagerIdForOwner,
  type EmploymentProfile,
} from "./mock-users";
import {
  addReviewPendingNotification,
  removeNotificationsForAppraisal,
} from "./notification-store";
import { mirrorAppraisalCreateToErpnext } from "./erpnext";
import { getReviewWindows } from "./settings-store";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "appraisals.json");

/**
 * Default: file store in local development; in-memory on serverless unless
 * APPRAISAL_STORE=file. Set APPRAISAL_STORE=memory to force in-memory in dev.
 */
const USE_MEMORY_STORE =
  process.env.APPRAISAL_STORE === "memory" ||
  (process.env.APPRAISAL_STORE !== "file" &&
    process.env.NODE_ENV !== "development");

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
    selfRating: null,
    managerRating: null,
    managerComments: "",
    midYearRating: null,
    midYearComment: "",
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
 * An employee may hold as many DRAFT appraisals as they like - drafts are
 * never touched or removed here. But only one ACTIVE (non-draft: submitted,
 * reviewed, or completed) appraisal per owner may exist at a time; that's
 * the real constraint, enforced primarily at submit time (see
 * `assertNoOtherActiveAppraisal` and its call site in the appraisals API
 * route). This pass is a safety net, not the primary gate: it collapses
 * non-draft duplicates down to the last one in list order, in case one ever
 * slips through (a race, a bug, stray data from before this rule existed).
 * Draft rows are always kept, however many there are.
 */
/** owner + cycle is the real key for "one active appraisal" - see cycleYear's docstring in types.ts. */
function activeKey(a: Appraisal): string {
  return `${a.ownerUserId}::${a.cycleYear}`;
}

async function enforceOneActiveAppraisalPerOwner(list: Appraisal[]): Promise<{
  next: Appraisal[];
  changed: boolean;
}> {
  const chosenActive = new Map<string, Appraisal>();
  for (const a of list) {
    if (a.status === "draft") continue;
    chosenActive.set(activeKey(a), a);
  }
  const keepActiveIds = new Set([...chosenActive.values()].map((x) => x.id));
  const dropped = list.filter(
    (a) => a.status !== "draft" && !keepActiveIds.has(a.id)
  );
  for (const a of dropped) {
    await removeNotificationsForAppraisal(a.id);
  }

  const ordered: Appraisal[] = [];
  const seenActiveKey = new Set<string>();
  for (const a of list) {
    if (a.status === "draft") {
      ordered.push(a);
      continue;
    }
    const key = activeKey(a);
    const pick = chosenActive.get(key)!;
    if (a.id !== pick.id || seenActiveKey.has(key)) continue;
    ordered.push(a);
    seenActiveKey.add(key);
  }

  const changed = ordered.length !== list.length;
  return { next: ordered, changed };
}

async function applyAppraisalListPolicy(
  list: Appraisal[]
): Promise<{ next: Appraisal[]; changed: boolean }> {
  return enforceOneActiveAppraisalPerOwner(list);
}

/**
 * True if `ownerUserId` already has an appraisal in `cycleYear` with
 * status !== "draft", other than `excludeId`. Scoped to the SAME cycle
 * deliberately - a completed appraisal from a prior cycle must never block
 * submitting this cycle's (see cycleYear's docstring in types.ts for why
 * that bug existed before this field did). Callers use this to refuse a
 * submit ("save" is always allowed - only submitting turns a draft into
 * the one active slot for its cycle).
 */
export async function hasOtherActiveAppraisal(
  ownerUserId: string,
  excludeId: string,
  cycleYear: number
): Promise<boolean> {
  const list = await readAppraisals();
  return list.some(
    (a) =>
      a.ownerUserId === ownerUserId &&
      a.id !== excludeId &&
      a.cycleYear === cycleYear &&
      a.status !== "draft"
  );
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

async function ensureDemoHrPersonalAppraisal(
  list: Appraisal[]
): Promise<Appraisal[]> {
  if (process.env.DISABLE_DEMO_APPRAISAL_SEED === "1") {
    return list;
  }
  if (list.some((a) => a.ownerUserId === DEMO_HR.id)) {
    return list;
  }
  const demo = buildDemoHrPersonalAppraisal();
  list.push(demo);
  await writeAppraisals(list);
  return list;
}

async function ensureDemoCompletedForHr(list: Appraisal[]): Promise<Appraisal[]> {
  if (process.env.DISABLE_DEMO_APPRAISAL_SEED === "1") {
    return list;
  }
  const seeds = buildDemoHrCompletedAppraisals();
  let changed = false;
  for (const demo of seeds) {
    const idx = list.findIndex((a) => a.id === demo.id);
    if (idx === -1) {
      if (list.some((a) => a.ownerUserId === demo.ownerUserId)) continue;
      list.push(demo);
      changed = true;
      continue;
    }
    /* Refresh mid-year dummy fields on existing HR demo rows so UI logic is easy to check. */
    const current = list[idx]!;
    const needsMidYearRefresh =
      current.midYearStatus !== "completed" ||
      current.kpis.some(
        (k, i) =>
          k.midYearRating == null ||
          k.midYearRating !== demo.kpis[i]?.midYearRating ||
          !k.midYearComment?.trim()
      ) ||
      current.capabilities.some(
        (c, i) =>
          c.midYearComment !== demo.capabilities[i]?.midYearComment
      );
    if (!needsMidYearRefresh) continue;
    list[idx] = {
      ...current,
      midYearStatus: demo.midYearStatus,
      midYearManagerComments: demo.midYearManagerComments,
      kpis: current.kpis.map((k, i) => ({
        ...k,
        midYearRating: demo.kpis[i]?.midYearRating ?? k.midYearRating,
        midYearComment: demo.kpis[i]?.midYearComment ?? k.midYearComment,
      })),
      capabilities: current.capabilities.map((c, i) => ({
        ...c,
        midYearRating: null,
        midYearComment:
          demo.capabilities[i]?.midYearComment ?? c.midYearComment,
      })),
    };
    changed = true;
  }
  if (changed) {
    await writeAppraisals(list);
  }
  return list;
}

export async function readAppraisals(): Promise<Appraisal[]> {
  let list = await ensureFile();
  list = await ensureDemoSubmittedEmmaForMark(list);
  list = await ensureDemoHrPersonalAppraisal(list);
  list = await ensureDemoCompletedForHr(list);
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

/**
 * Creates a draft appraisal.
 *
 * `owner` is supplied by the caller for anyone outside the demo roster - a
 * Microsoft-authenticated user, whose employment details come from ERPNext
 * rather than mock-users. The route resolves it from the signed-in session
 * server-side; it is never taken from the request body, or a caller could
 * mint an appraisal with whatever job title and manager they fancied.
 *
 * Without `owner` this behaves exactly as before, looking the four demo
 * logins up in the roster.
 */
export async function createAppraisal(
  ownerUserId: string,
  owner?: { profile: EmploymentProfile; reviewingManagerId: string | null }
): Promise<Appraisal> {
  const user = owner ? null : findMockUser(ownerUserId);
  if (!owner && !user) {
    throw new Error("Unknown employee");
  }
  const list = await readAppraisals();
  const id = randomUUID();
  const profile = owner ? owner.profile : employmentProfileFromUser(user!);
  const reviewingManagerId = owner
    ? owner.reviewingManagerId
    : reviewingManagerIdForOwner(ownerUserId);
  const { currentCycleYear } = await getReviewWindows();
  const raw = {
    id,
    cycleYear: currentCycleYear,
    ownerUserId,
    reviewingManagerId,
    ...profile,
    status: "draft" as const,
    kpis: Array.from({ length: MIN_KPIS }, () => ({
      goalsAndKpis: "",
      weightPercent: 0,
      dueDate: "",
      selfRating: null,
      managerRating: null,
      managerComments: "",
    })),
    capabilities: defaultCapabilities(),
    employeeComments: "",
    managerComments: "",
    managerOverallOverride: null,
  };
  const appraisal = migrateAppraisal(raw);
  const withNew = [...list, appraisal];
  await writeAppraisals(withNew);
  const { next, changed } = await applyAppraisalListPolicy(withNew);
  if (changed) {
    await writeAppraisals(next);
  }
  const finalList = changed ? next : withNew;
  const result = finalList.find((a) => a.id === id) ?? appraisal;

  // First real ERPNext wiring slice: mirror the create into ERPNext (dev
  // site) so we can prove the connection actually works end to end. Runs
  // after the local write succeeds; awaited (rather than fire-and-forget)
  // so it reliably completes before the request ends, but a failure here
  // still never breaks the local demo flow - see erpnext.ts's module
  // docstring for what this does and does not cover yet.
  await mirrorAppraisalCreateToErpnext(ownerUserId, currentCycleYear);

  return result;
}

function clampOptionalRating(n: unknown): number | null {
  if (n == null || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  if (r < 1 || r > 5) return null;
  return r;
}

function clampKpis(kpis: KpiRow[]): KpiRow[] {
  return kpis.slice(0, MAX_KPIS).map((k) => ({
    ...k,
    weightPercent: Math.min(100, Math.max(0, Number(k.weightPercent) || 0)),
    selfRating: clampOptionalRating(k.selfRating),
    managerRating:
      k.managerRating == null ? null : clampOptionalRating(k.managerRating),
  }));
}

function clampCapabilities(rows: CapabilityRow[]): CapabilityRow[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return CAPABILITY_ORDER.map((id) => {
    const r = byId.get(id);
    return {
      id,
      selfRating: clampOptionalRating(r?.selfRating),
      managerRating:
        r?.managerRating == null ? null : clampOptionalRating(r.managerRating),
      managerComments: String(r?.managerComments ?? ""),
      midYearRating: clampOptionalRating(r?.midYearRating),
      midYearComment: String(r?.midYearComment ?? ""),
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
