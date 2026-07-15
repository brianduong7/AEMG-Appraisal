import type {
  Appraisal,
  CapabilityId,
  CapabilityRow,
  CycleStatus,
  KpiRow,
  MidYearRating,
} from "./types";
import { CAPABILITY_ORDER, ENTITY_OPTIONS } from "./types";
import { findMockUser } from "./mock-users";

function migrateMidYearRating(raw: unknown): MidYearRating | null {
  if (raw === "on_track" || raw === "not_on_track" || raw === "early_access") {
    return raw;
  }
  return null;
}

function migrateMidYearStatus(
  raw: unknown,
  annualStatus: unknown,
  kpis: unknown
): CycleStatus {
  /* A completed annual implies the mid-year checkpoint already passed —
     legacy rows predate the mid-year cycle and must not report Not Started. */
  if (annualStatus === "completed" && (raw == null || raw === "not_started")) {
    return "completed";
  }
  /* Legacy: KPIs submitted but mid-year never started → KPI Created. */
  if (
    annualStatus === "submitted" &&
    (raw == null || raw === "not_started")
  ) {
    return "kpi_created";
  }
  /* Legacy "draft" with no mid-year ratings yet was the old post-KPI state. */
  if (annualStatus === "submitted" && raw === "draft") {
    const list = Array.isArray(kpis) ? kpis : [];
    const hasMidYear = list.some((row) => {
      const r = (row as Record<string, unknown>)?.midYearRating;
      return r != null && r !== "";
    });
    if (!hasMidYear) return "kpi_created";
  }
  if (
    raw === "not_started" ||
    raw === "kpi_created" ||
    raw === "kpi_approved" ||
    raw === "draft" ||
    raw === "submitted" ||
    raw === "completed"
  ) {
    return raw;
  }
  return "not_started";
}

function clampLevel(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n)));
}

function clampRating(n: unknown, fallback: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.min(5, Math.max(1, Math.round(v)));
}

/** 1–5 or null when unset / legacy empty. */
function migrateSelfRating(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const v = Number(raw);
  if (Number.isNaN(v)) return null;
  return Math.min(5, Math.max(1, Math.round(v)));
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
      selfRating: migrateSelfRating(o.selfRating),
      managerRating:
        o.managerRating == null || o.managerRating === ""
          ? null
          : clampRating(o.managerRating, 3),
      managerComments: String(o.managerComments ?? ""),
      midYearRating: migrateMidYearRating(o.midYearRating),
      midYearComment: String(o.midYearComment ?? ""),
    };
  }
  const title = String(o.title ?? "");
  const desc = String(o.description ?? "");
  const merged = [title, desc].filter(Boolean).join(" — ");
  return {
    goalsAndKpis: merged,
    weightPercent: Math.min(100, Math.max(0, Number(o.weightPercent) || 20)),
    dueDate: String(o.dueDate ?? ""),
    selfRating: migrateSelfRating(o.selfRating),
    managerRating:
      o.managerRating == null || o.managerRating === ""
        ? null
        : clampRating(o.managerRating, 3),
    managerComments: String(o.managerComments ?? ""),
    midYearRating: migrateMidYearRating(o.midYearRating),
    midYearComment: String(o.midYearComment ?? ""),
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
      selfRating: migrateSelfRating(o.selfRating),
      managerRating:
        o.managerRating == null || o.managerRating === ""
          ? null
          : clampRating(o.managerRating, 3),
      managerComments: String(o.managerComments ?? ""),
      midYearRating: migrateSelfRating(o.midYearRating),
      midYearComment: String(o.midYearComment ?? ""),
    });
  }
  return CAPABILITY_ORDER.map((id) => {
    return (
      byId.get(id) ?? {
        id,
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
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

  let ownerUserId =
    typeof a.ownerUserId === "string" && a.ownerUserId
      ? String(a.ownerUserId)
      : "emma";
  if (ownerUserId === "1") ownerUserId = "emma";
  if (ownerUserId === "2") ownerUserId = "mark";

  const rawReviewing = a.reviewingManagerId;
  const reviewingManagerId =
    typeof rawReviewing === "string" && rawReviewing.trim()
      ? String(rawReviewing)
      : ownerUserId === "emma"
        ? "mark"
        : ownerUserId === "mark"
          ? null
          : String(a.managerName ?? "").toLowerCase().includes("mark")
            ? "mark"
            : null;

  const directory = findMockUser(ownerUserId);
  const employeeName = directory
    ? directory.englishName || directory.employeeName
    : String(a.employeeName ?? "");
  const englishName = directory
    ? directory.englishName
    : String(a.englishName ?? a.employeeName ?? "");
  const managerName = directory
    ? directory.managerName
    : String(a.managerName ?? "");

  return {
    id: String(a.id ?? ""),
    ownerUserId,
    reviewingManagerId,
    employeeName,
    englishName,
    position: String(a.position ?? ""),
    department: String(a.department ?? ""),
    mLevel: clampLevel(Number(a.mLevel) || 3),
    managerName,
    entity,
    status:
      a.status === "submitted" ||
      a.status === "reviewed" ||
      a.status === "completed" ||
      a.status === "draft"
        ? a.status
        : "draft",
    midYearStatus: migrateMidYearStatus(a.midYearStatus, a.status, a.kpis),
    midYearManagerComments: String(a.midYearManagerComments ?? ""),
    kpis:
      kpis.length > 0
        ? kpis
        : [
            {
              goalsAndKpis: "",
              weightPercent: 0,
              dueDate: "",
              selfRating: null,
              managerRating: null,
              managerComments: "",
              midYearRating: null,
              midYearComment: "",
            },
          ],
    capabilities: migrateCapabilities(a.capabilities),
    employeeComments,
    managerComments: String(a.managerComments ?? ""),
    managerOverallOverride:
      a.managerOverallOverride == null || a.managerOverallOverride === ""
        ? null
        : Math.min(5, Math.max(1, Math.round(Number(a.managerOverallOverride)))),
  };
}
