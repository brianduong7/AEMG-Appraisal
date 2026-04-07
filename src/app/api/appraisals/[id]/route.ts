import { NextResponse } from "next/server";
import { getAppraisal, updateAppraisal } from "@/lib/appraisal-store";
import {
  addReviewPendingNotification,
  removeNotificationsForAppraisal,
} from "@/lib/notification-store";
import type {
  Appraisal,
  CapabilityId,
  CapabilityRow,
  KpiRow,
} from "@/lib/types";
import { CAPABILITY_ORDER, MAX_KPIS } from "@/lib/types";
import { sumKpiWeights } from "@/lib/kpi-utils";

type EmployeePayload = Pick<
  Appraisal,
  | "employeeName"
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

function normalizeKpisFromEmployee(rows: unknown[]): KpiRow[] {
  return rows.slice(0, MAX_KPIS).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      goalsAndKpis: String(r.goalsAndKpis ?? ""),
      weightPercent: Math.min(
        100,
        Math.max(0, Number(r.weightPercent) || 0)
      ),
      dueDate: String(r.dueDate ?? ""),
      selfRating: Math.min(5, Math.max(1, Number(r.selfRating) || 3)),
      managerRating: null,
      managerComments: "",
    };
  });
}

function normalizeCapabilitiesFromEmployee(rows: unknown[]): CapabilityRow[] {
  const byId = new Map<CapabilityId, CapabilityRow>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const id = r.id as CapabilityId;
      if (!CAPABILITY_ORDER.includes(id)) continue;
      byId.set(id, {
        id,
        selfRating: Math.min(5, Math.max(1, Number(r.selfRating) || 3)),
        managerRating: null,
        managerComments: "",
      });
    }
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
    if (data.capabilities.length !== CAPABILITY_ORDER.length) {
      return NextResponse.json(
        { error: "Invalid capabilities payload" },
        { status: 400 }
      );
    }

    const kpis = normalizeKpisFromEmployee(data.kpis);
    const capabilities = normalizeCapabilitiesFromEmployee(data.capabilities);

    if (action === "employee_submit") {
      const w = sumKpiWeights(kpis);
      if (Math.abs(w - 100) > 0.01) {
        return NextResponse.json(
          { error: `KPI weights must total 100% (currently ${w}%).` },
          { status: 400 }
        );
      }
    }

    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "draft") {
        return null;
      }
      const mLevel = Math.min(
        10,
        Math.max(1, Math.round(Number((data as { mLevel: unknown }).mLevel) || 3))
      );
      return {
        ...current,
        employeeName: data.employeeName,
        position: data.position,
        department: data.department,
        mLevel,
        managerName: data.managerName,
        entity: data.entity,
        kpis,
        capabilities,
        employeeComments: data.employeeComments,
        managerComments: current.managerComments,
        status: action === "employee_submit" ? "submitted" : "draft",
      };
    });

    if (!next) {
      return NextResponse.json(
        { error: "Cannot update: not in draft or not found" },
        { status: 409 }
      );
    }
    if (
      action === "employee_submit" &&
      next.status === "submitted" &&
      next.reviewingManagerId
    ) {
      await addReviewPendingNotification({
        appraisalId: next.id,
        managerUserId: next.reviewingManagerId,
        employeeName: next.employeeName,
      });
    }
    return NextResponse.json(next);
  }

  if (action === "manager_submit") {
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

    const next = await updateAppraisal(id, (current) => {
      if (current.status !== "submitted") {
        return null;
      }
      if (
        kpisPayload.length !== current.kpis.length ||
        capsPayload.length !== current.capabilities.length
      ) {
        return null;
      }
      const mergedKpis = current.kpis.map((k, i) => {
        const m = kpisPayload[i] as Record<string, unknown>;
        const mr = Math.min(5, Math.max(1, Number(m?.managerRating) || 3));
        return {
          ...k,
          managerRating: mr,
          managerComments: String(m?.managerComments ?? ""),
        };
      });
      const mergedCaps = current.capabilities.map((c, i) => {
        const m = capsPayload[i] as Record<string, unknown>;
        const mr = Math.min(5, Math.max(1, Number(m?.managerRating) || 3));
        return {
          ...c,
          managerRating: mr,
          managerComments: String(m?.managerComments ?? ""),
        };
      });
      return {
        ...current,
        kpis: mergedKpis,
        capabilities: mergedCaps,
        managerComments: appraisalComments,
        status: "reviewed" as const,
      };
    });

    if (!next) {
      return NextResponse.json(
        {
          error:
            "Cannot submit manager review: appraisal must be submitted and row counts must match",
        },
        { status: 409 }
      );
    }
    await removeNotificationsForAppraisal(id);
    return NextResponse.json(next);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
