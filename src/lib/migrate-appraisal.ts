import type {
  Appraisal,
  CapabilityId,
  CapabilityRow,
  KpiRow,
} from "./types";
import { CAPABILITY_ORDER, ENTITY_OPTIONS } from "./types";

function clampLevel(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n)));
}

function clampRating(n: unknown, fallback: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.min(5, Math.max(1, Math.round(v)));
}

function defaultCapabilities(): CapabilityRow[] {
  return CAPABILITY_ORDER.map((id) => ({
    id,
    selfRating: 3,
    managerRating: null,
    managerComments: "",
  }));
}

function migrateKpiRow(raw: unknown): KpiRow {
  const o = raw as Record<string, unknown>;
  if (typeof o.goalsAndKpis === "string") {
    return {
      goalsAndKpis: o.goalsAndKpis,
      weightPercent: Math.min(
        100,
        Math.max(0, Number(o.weightPercent) || 0)
      ),
      dueDate: String(o.dueDate ?? ""),
      selfRating: clampRating(o.selfRating, 3),
      managerRating:
        o.managerRating == null || o.managerRating === ""
          ? null
          : clampRating(o.managerRating, 3),
      managerComments: String(o.managerComments ?? ""),
    };
  }
  const title = String(o.title ?? "");
  const desc = String(o.description ?? "");
  const merged = [title, desc].filter(Boolean).join(" — ");
  return {
    goalsAndKpis: merged,
    weightPercent: Math.min(100, Math.max(0, Number(o.weightPercent) || 20)),
    dueDate: String(o.dueDate ?? ""),
    selfRating: clampRating(o.selfRating, 3),
    managerRating:
      o.managerRating == null || o.managerRating === ""
        ? null
        : clampRating(o.managerRating, 3),
    managerComments: String(o.managerComments ?? ""),
  };
}

function migrateCapabilities(raw: unknown): CapabilityRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return defaultCapabilities();
  }
  const byId = new Map<CapabilityId, CapabilityRow>();
  for (const row of raw) {
    const o = row as Record<string, unknown>;
    const id = o.id as CapabilityId;
    if (!CAPABILITY_ORDER.includes(id)) continue;
    byId.set(id, {
      id,
      selfRating: clampRating(o.selfRating, 3),
      managerRating:
        o.managerRating == null || o.managerRating === ""
          ? null
          : clampRating(o.managerRating, 3),
      managerComments: String(o.managerComments ?? ""),
    });
  }
  return CAPABILITY_ORDER.map((id) => {
    return (
      byId.get(id) ?? {
        id,
        selfRating: 3,
        managerRating: null,
        managerComments: "",
      }
    );
  });
}

export function migrateAppraisal(raw: unknown): Appraisal {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid appraisal");
  }
  const a = raw as Record<string, unknown>;
  const kpis = Array.isArray(a.kpis)
    ? a.kpis.map(migrateKpiRow)
    : [];

  const achievements = String(a.achievements ?? "");
  const challenges = String(a.challenges ?? "");
  const training = String(a.trainingNeeds ?? "");
  const legacyReflection = [achievements, challenges, training]
    .filter(Boolean)
    .join("\n\n");

  const employeeComments =
    typeof a.employeeComments === "string"
      ? a.employeeComments
      : legacyReflection;

  const entityRaw = String(a.entity ?? "");
  const entity = (ENTITY_OPTIONS as readonly string[]).includes(entityRaw)
    ? entityRaw
    : ENTITY_OPTIONS[0];

  const ownerUserId =
    typeof a.ownerUserId === "string" && a.ownerUserId
      ? String(a.ownerUserId)
      : "1";

  return {
    id: String(a.id ?? ""),
    ownerUserId,
    employeeName: String(a.employeeName ?? ""),
    position: String(a.position ?? ""),
    department: String(a.department ?? ""),
    mLevel: clampLevel(Number(a.mLevel) || 3),
    managerName: String(a.managerName ?? ""),
    entity,
    status:
      a.status === "submitted" || a.status === "reviewed" || a.status === "draft"
        ? a.status
        : "draft",
    kpis:
      kpis.length > 0
        ? kpis
        : [
            {
              goalsAndKpis: "",
              weightPercent: 20,
              dueDate: "",
              selfRating: 3,
              managerRating: null,
              managerComments: "",
            },
          ],
    capabilities: migrateCapabilities(a.capabilities),
    employeeComments,
    managerComments: String(a.managerComments ?? ""),
  };
}
