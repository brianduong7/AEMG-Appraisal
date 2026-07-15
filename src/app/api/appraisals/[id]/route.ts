import { NextResponse } from "next/server";
import { getAppraisal, updateAppraisal } from "@/lib/appraisal-store";
import { DEMO_HR, DEMO_MANAGER } from "@/lib/mock-users";
import {
  addReviewPendingNotification,
  removeNotificationsForAppraisal,
} from "@/lib/notification-store";
import { getReviewWindows } from "@/lib/settings-store";
import type {
  Appraisal,
  CapabilityId,
  CapabilityRow,
  KpiRow,
  MidYearRating,
} from "@/lib/types";
import {
  CAPABILITY_ORDER,
  MAX_KPIS,
  MIN_KPIS,
  MID_YEAR_RATING_OPTIONS,
} from "@/lib/types";
import { sumKpiWeights } from "@/lib/kpi-utils";

function parseOptionalRating(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  if (r < 1 || r > 5) return null;
  return r;
}

/** Initial KPI lock — weights and KPI text only; no self-ratings yet. */
function employeeKpiSubmitValidationError(kpis: KpiRow[]): string | null {
  if (kpis.length < MIN_KPIS) {
    return `Add at least ${MIN_KPIS} KPIs before submitting.`;
  }
  if (kpis.length > MAX_KPIS) {
    return `Maximum ${MAX_KPIS} KPIs.`;
  }
  for (const k of kpis) {
    if ((Number(k.weightPercent) || 0) <= 0) {
      return "Each KPI must have a weight greater than 0%.";
    }
  }
  const total = sumKpiWeights(kpis);
  if (Math.abs(total - 100) >= 0.01) {
    return "KPI weights must total exactly 100% before submitting.";
  }
  return null;
}

function employeeAnnualSubmitValidationError(
  kpis: KpiRow[],
  capabilities: CapabilityRow[]
): string | null {
  for (const k of kpis) {
    if (k.selfRating == null) {
      return "Select a self rating for every KPI before submitting.";
    }
  }
  for (const c of capabilities) {
    if (c.selfRating == null) {
      return "Select a self rating for every capability before submitting.";
    }
  }
  return null;
}

function employeeMidYearSubmitValidationError(
  lines: { midYearRating: MidYearRating | null }[]
): string | null {
  for (const l of lines) {
    if (l.midYearRating == null) {
      return "Select On Track / Not on Track for every KPI before submitting your mid-year review.";
    }
  }
  return null;
}

type EmployeePayload = Pick<
  Appraisal,
  | "employeeName"
  | "englishName"
  | "position"
  | "department"
  | "mLevel"
  | "managerName"
  | "entity"
  | "kpis"
  | "capabilities"
  | "employeeComments"
>;

function isEmployeePayload(x: unknown): x is EmployeePayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const mLevel = Number(o.mLevel);
  return (
    typeof o.employeeName === "string" &&
    typeof o.englishName === "string" &&
    typeof o.position === "string" &&
    typeof o.department === "string" &&
    typeof o.managerName === "string" &&
    typeof o.entity === "string" &&
    Number.isFinite(mLevel) &&
    Array.isArray(o.kpis) &&
    Array.isArray(o.capabilities) &&
    typeof o.employeeComments === "string"
  );
}

function parseMidYearRating(raw: unknown): MidYearRating | null {
  return MID_YEAR_RATING_OPTIONS.includes(raw as MidYearRating)
    ? (raw as MidYearRating)
    : null;
}

/** Mid-year fields are manager-owned: keep the stored values, not the payload's. */
function normalizeKpisFromEmployee(
  rows: unknown[],
  current: KpiRow[]
): KpiRow[] {
  return rows.slice(0, MAX_KPIS).map((row, i) => {
    const r = row as Record<string, unknown>;
    return {
      goalsAndKpis: String(r.goalsAndKpis ?? ""),
      weightPercent: Math.min(
        100,
        Math.max(0, Number(r.weightPercent) || 0)
      ),
      dueDate: String(r.dueDate ?? ""),
      selfRating: parseOptionalRating(r.selfRating),
      managerRating: null,
      managerComments: "",
      midYearRating: current[i]?.midYearRating ?? null,
      midYearComment: current[i]?.midYearComment ?? "",
    };
  });
}

function normalizeCapabilitiesFromEmployee(
  rows: unknown[],
  current: CapabilityRow[] = []
): CapabilityRow[] {
  const currentById = new Map(current.map((c) => [c.id, c]));
  const byId = new Map<CapabilityId, CapabilityRow>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const id = r.id as CapabilityId;
      if (!CAPABILITY_ORDER.includes(id)) continue;
      const prev = currentById.get(id);
      byId.set(id, {
        id,
        selfRating: parseOptionalRating(r.selfRating),
        managerRating: null,
        managerComments: "",
        midYearRating: prev?.midYearRating ?? null,
        midYearComment: prev?.midYearComment ?? "",
      });
    }
  }
  return CAPABILITY_ORDER.map((id) => {
    return (
      byId.get(id) ?? {
        id,
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: currentById.get(id)?.midYearRating ?? null,
        midYearComment: currentById.get(id)?.midYearComment ?? "",
      }
    );
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const appraisal = await getAppraisal(id);
  if (!appraisal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(appraisal);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = (body as { action?: string }).action;
  const data = (body as { data?: unknown }).data;

  if (action === "employee_save" || action === "employee_submit") {
    if (!isEmployeePayload(data)) {
      return NextResponse.json({ error: "Invalid employee data" }, { status: 400 });
    }
    if (data.kpis.length > MAX_KPIS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_KPIS} KPIs` },
        { status: 400 }
      );
    }
    if (action === "employee_submit" && data.kpis.length < MIN_KPIS) {
      return NextResponse.json(
        { error: `Add at least ${MIN_KPIS} KPIs before submitting.` },
        { status: 400 }
      );
    }
    if (data.capabilities.length !== CAPABILITY_ORDER.length) {
      return NextResponse.json(
        { error: "Invalid capabilities payload" },
        { status: 400 }
      );
    }

    const kpisForValidation = normalizeKpisFromEmployee(data.kpis, []);
    const capabilitiesForValidation = normalizeCapabilitiesFromEmployee(
      data.capabilities,
      []
    );

    if (action === "employee_submit") {
      const windows = await getReviewWindows();
      if (!windows.kpiSubmissionOpen) {
        return NextResponse.json(
          {
            error:
              "KPI submission is locked by HR. Try again when the window is open.",
          },
          { status: 403 }
        );
      }
      const err = employeeKpiSubmitValidationError(kpisForValidation);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "draft") {
        return null;
      }
      const kpis = normalizeKpisFromEmployee(data.kpis, current.kpis);
      const capabilities = normalizeCapabilitiesFromEmployee(
        data.capabilities,
        current.capabilities
      );
      const mLevel = Math.min(
        10,
        Math.max(1, Math.round(Number((data as { mLevel: unknown }).mLevel) || 3))
      );
      const reviewingManagerId =
        action === "employee_submit"
          ? (current.reviewingManagerId ?? DEMO_MANAGER.id)
          : current.reviewingManagerId;

      return {
        ...current,
        employeeName: data.employeeName,
        englishName: data.englishName,
        position: data.position,
        department: data.department,
        mLevel,
        managerName: data.managerName,
        entity: data.entity,
        kpis,
        capabilities,
        employeeComments: data.employeeComments,
        managerComments: current.managerComments,
        reviewingManagerId,
        managerOverallOverride: current.managerOverallOverride,
        status: action === "employee_submit" ? "submitted" : "draft",
        midYearStatus:
          action === "employee_submit" ? "kpi_created" : current.midYearStatus,
      };
    });

    if (!next) {
      return NextResponse.json(
        { error: "Cannot update: not in draft or not found" },
        { status: 409 }
      );
    }
    if (action === "employee_submit" && next.status === "submitted") {
      const managerUserId = next.reviewingManagerId ?? DEMO_MANAGER.id;
      await addReviewPendingNotification({
        appraisalId: next.id,
        managerUserId,
        employeeName: next.employeeName,
      });
      /* Also notify HR that KPIs were submitted for this cycle. */
      if (managerUserId !== DEMO_HR.id) {
        await addReviewPendingNotification({
          appraisalId: next.id,
          managerUserId: DEMO_HR.id,
          employeeName: next.employeeName,
        });
      }
    }
    return NextResponse.json(next);
  }

  if (action === "manager_kpi_approve") {
    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "submitted") {
        return null;
      }
      if (current.midYearStatus !== "kpi_created") {
        return null;
      }
      return {
        ...current,
        midYearStatus: "kpi_approved" as const,
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot approve KPIs: employee must submit KPIs first (status KPI Created).",
        },
        { status: 409 }
      );
    }
    await removeNotificationsForAppraisal(id);
    return NextResponse.json(next);
  }

  if (
    action === "employee_midyear_save" ||
    action === "employee_midyear_submit"
  ) {
    const windows = await getReviewWindows();
    if (!windows.midYearReviewOpen) {
      return NextResponse.json(
        {
          error:
            "Mid-year review is locked by HR. Try again when the window is open.",
        },
        { status: 403 }
      );
    }
    const kpisPayload = (body as { kpis?: unknown }).kpis;
    if (!Array.isArray(kpisPayload)) {
      return NextResponse.json(
        { error: "Invalid mid-year payload" },
        { status: 400 }
      );
    }
    const lines = kpisPayload.map((row) => {
      const r = row as Record<string, unknown>;
      return { midYearRating: parseMidYearRating(r.midYearRating) };
    });

    if (action === "employee_midyear_submit") {
      const err = employeeMidYearSubmitValidationError(lines);
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "submitted") {
        return null;
      }
      if (
        current.midYearStatus !== "kpi_approved" &&
        current.midYearStatus !== "draft"
      ) {
        return null;
      }
      if (lines.length !== current.kpis.length) {
        return null;
      }
      return {
        ...current,
        kpis: current.kpis.map((k, i) => ({
          ...k,
          midYearRating: lines[i]!.midYearRating,
        })),
        midYearStatus:
          action === "employee_midyear_submit" ? "submitted" : "draft",
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot save mid-year review: KPIs must be submitted first and mid-year must not be finalized.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(next);
  }

  if (action === "employee_annual_save" || action === "employee_annual_submit") {
    const windows = await getReviewWindows();
    if (!windows.annualReviewOpen) {
      return NextResponse.json(
        {
          error:
            "Annual review is locked by HR. Try again when the window is open.",
        },
        { status: 403 }
      );
    }
    if (!isEmployeePayload(data)) {
      return NextResponse.json({ error: "Invalid employee data" }, { status: 400 });
    }
    const kpisForValidation = normalizeKpisFromEmployee(data.kpis, []);
    const capabilitiesForValidation = normalizeCapabilitiesFromEmployee(
      data.capabilities,
      []
    );

    if (action === "employee_annual_submit") {
      const err = employeeAnnualSubmitValidationError(
        kpisForValidation,
        capabilitiesForValidation
      );
      if (err) {
        return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "submitted") {
        return null;
      }
      if (current.midYearStatus !== "completed") {
        return null;
      }
      const kpis = current.kpis.map((k, i) => {
        const row = (data.kpis[i] ?? {}) as Record<string, unknown>;
        return {
          ...k,
          selfRating: parseOptionalRating(row.selfRating),
        };
      });
      const capabilities = normalizeCapabilitiesFromEmployee(
        data.capabilities,
        current.capabilities
      );

      return {
        ...current,
        kpis,
        capabilities,
        employeeComments: data.employeeComments,
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot save annual ratings: mid-year review must be completed first.",
        },
        { status: 409 }
      );
    }
    if (action === "employee_annual_submit") {
      await addReviewPendingNotification({
        appraisalId: next.id,
        managerUserId: next.reviewingManagerId ?? DEMO_MANAGER.id,
        employeeName: next.employeeName,
      });
    }
    return NextResponse.json(next);
  }

  if (action === "manager_submit") {
    const windows = await getReviewWindows();
    if (!windows.annualReviewOpen) {
      return NextResponse.json(
        {
          error:
            "Annual review is locked by HR. Try again when the window is open.",
        },
        { status: 403 }
      );
    }
    const kpisPayload = (body as { kpis?: unknown }).kpis;
    const capsPayload = (body as { capabilities?: unknown }).capabilities;
    if (!Array.isArray(kpisPayload) || !Array.isArray(capsPayload)) {
      return NextResponse.json(
        { error: "Invalid manager payload" },
        { status: 400 }
      );
    }

    const appraisalComments = String(
      (body as { managerComments?: unknown }).managerComments ?? ""
    );
    const managerOverallOverride = parseOptionalRating(
      (body as { managerOverallOverride?: unknown }).managerOverallOverride
    );

    const kpiManagerRatings = kpisPayload.map((row) =>
      parseOptionalRating((row as Record<string, unknown>).managerRating)
    );
    const capManagerRatings = capsPayload.map((row) =>
      parseOptionalRating((row as Record<string, unknown>).managerRating)
    );
    if (kpiManagerRatings.some((r) => r == null)) {
      return NextResponse.json(
        { error: "Select a manager rating for every KPI before submitting." },
        { status: 400 }
      );
    }
    if (capManagerRatings.some((r) => r == null)) {
      return NextResponse.json(
        {
          error:
            "Select a manager rating for every capability before submitting.",
        },
        { status: 400 }
      );
    }

    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "submitted" && current.status !== "reviewed") {
        return null;
      }
      if (current.midYearStatus !== "completed") {
        return null;
      }
      if (
        current.kpis.some((k) => k.selfRating == null) ||
        current.capabilities.some((c) => c.selfRating == null)
      ) {
        return null;
      }
      if (
        kpisPayload.length !== current.kpis.length ||
        capsPayload.length !== current.capabilities.length
      ) {
        return null;
      }
      const mergedKpis = current.kpis.map((k, i) => {
        const mr = kpiManagerRatings[i]!;
        return {
          ...k,
          managerRating: mr,
          managerComments: "",
        };
      });
      const mergedCaps = current.capabilities.map((c, i) => {
        const mr = capManagerRatings[i]!;
        return {
          ...c,
          managerRating: mr,
          managerComments: "",
        };
      });
      return {
        ...current,
        kpis: mergedKpis,
        capabilities: mergedCaps,
        managerComments: appraisalComments,
        managerOverallOverride,
        status: "reviewed" as const,
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot update manager review: appraisal must be submitted or reviewed, with matching row counts",
        },
        { status: 409 }
      );
    }
    await removeNotificationsForAppraisal(id);
    return NextResponse.json(next);
  }

  if (action === "manager_complete") {
    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "reviewed") {
        return null;
      }
      return {
        ...current,
        status: "completed" as const,
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot complete: appraisal must be reviewed by the manager first.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(next);
  }

  if (action === "manager_midyear_save" || action === "manager_midyear_submit") {
    const windows = await getReviewWindows();
    if (!windows.midYearReviewOpen) {
      return NextResponse.json(
        {
          error:
            "Mid-year review is locked by HR. Try again when the window is open.",
        },
        { status: 403 }
      );
    }
    const kpisPayload = (body as { kpis?: unknown }).kpis;
    const capsPayload = (body as { capabilities?: unknown }).capabilities;
    if (!Array.isArray(kpisPayload)) {
      return NextResponse.json(
        { error: "Invalid mid-year payload" },
        { status: 400 }
      );
    }
    const midYearManagerComments = String(
      (body as { midYearManagerComments?: unknown }).midYearManagerComments ??
        ""
    );
    const lines = kpisPayload.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        midYearComment: String(r.midYearComment ?? ""),
      };
    });

    const capLines = Array.isArray(capsPayload)
      ? capsPayload.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            midYearComment: String(r.midYearComment ?? ""),
          };
        })
      : null;

    if (
      action === "manager_midyear_submit" &&
      lines.some((l) => !l.midYearComment.trim())
    ) {
      return NextResponse.json(
        {
          error:
            "Add a mid-year comment for every KPI before submitting the mid-year review.",
        },
        { status: 400 }
      );
    }

    const next = await updateAppraisal(id, (current) => {
      /* Mid-year manager comments after employee mid-year submit. */
      if (current.status !== "submitted" && current.status !== "reviewed") {
        return null;
      }
      if (current.midYearStatus !== "submitted") {
        return null;
      }
      if (lines.length !== current.kpis.length) {
        return null;
      }
      if (capLines && capLines.length !== current.capabilities.length) {
        return null;
      }
      if (
        action === "manager_midyear_submit" &&
        current.kpis.some((k) => k.midYearRating == null)
      ) {
        return null;
      }
      return {
        ...current,
        kpis: current.kpis.map((k, i) => ({
          ...k,
          midYearComment: lines[i]!.midYearComment,
        })),
        capabilities: current.capabilities.map((c, i) => ({
          ...c,
          midYearComment: capLines?.[i]?.midYearComment ?? c.midYearComment,
        })),
        midYearManagerComments,
        midYearStatus:
          action === "manager_midyear_submit" ? "completed" : current.midYearStatus,
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot save mid-year review: the employee must submit mid-year ratings first.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(next);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
