import { promises as fs } from "fs";
import path from "path";
import type { Appraisal, CapabilityRow, KpiRow } from "./types";
import { CAPABILITY_ORDER, ENTITY_OPTIONS, MAX_KPIS } from "./types";
import { migrateAppraisal } from "./migrate-appraisal";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "appraisals.json");

function defaultCapabilities(): CapabilityRow[] {
  return CAPABILITY_ORDER.map((id) => ({
    id,
    selfRating: 3,
    managerRating: null,
    managerComments: "",
  }));
}

function emptyAppraisalSeed(
  id: string,
  ownerUserId: string
): Record<string, unknown> {
  return {
    id,
    ownerUserId,
    employeeName: "",
    position: "",
    department: "",
    mLevel: 3,
    managerName: "",
    entity: ENTITY_OPTIONS[0],
    status: "draft",
    kpis: [
      {
        goalsAndKpis: "",
        weightPercent: 20,
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
}

function defaultAppraisals(): Appraisal[] {
  return [
    migrateAppraisal(emptyAppraisalSeed("1", "1")),
    migrateAppraisal(emptyAppraisalSeed("2", "2")),
  ];
}

async function ensureFile(): Promise<Appraisal[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seed = defaultAppraisals();
      await fs.writeFile(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
      return seed;
    }
    return parsed.map((item) => migrateAppraisal(item));
  } catch {
    const seed = defaultAppraisals();
    await fs.writeFile(DATA_FILE, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
}

export async function readAppraisals(): Promise<Appraisal[]> {
  return ensureFile();
}

export async function getAppraisal(id: string): Promise<Appraisal | null> {
  const list = await readAppraisals();
  return list.find((a) => a.id === id) ?? null;
}

export async function writeAppraisals(appraisals: Appraisal[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(appraisals, null, 2), "utf-8");
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
  return next;
}
