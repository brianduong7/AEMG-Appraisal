import { NextResponse } from "next/server";
import {
  deleteAppraisal,
  getAppraisal,
  hasOtherActiveAppraisal,
  updateAppraisal,
} from "@/lib/appraisal-store";
import { DEMO_HR, DEMO_MANAGER, findMockUser } from "@/lib/mock-users";
import {
  addReviewPendingNotification,
  removeNotificationsForAppraisal,
} from "@/lib/notification-store";
import { getReviewWindows } from "@/lib/settings-store";
import { resolveActor } from "@/lib/appraisal-actor";
import {
  getById,
  readsFromErpnext,
  statusForError,
  writesToErpnext,
} from "@/lib/appraisal-source";
import { erpnextApiCall } from "@/lib/erpnext";
import {
  applyErpnextAction,
  type WriteAction,
} from "@/lib/appraisal-writer";
import {
  mirrorKpiApproveToErpnext,
  mirrorMidYearCompleteToErpnext,
  mirrorAnnualManagerSubmitToErpnext,
  mirrorAppraisalCompleteToErpnext,
  mirrorHrUpdateToErpnext,
  mirrorKpiSubmitToErpnext,
  mirrorMidYearEmployeeSubmitToErpnext,
  mirrorAnnualSelfSubmitToErpnext,
} from "@/lib/erpnext";
import type {
  Appraisal,
  AppraisalStatus,
  CapabilityId,
  CapabilityRow,
  CycleStatus,
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
import {
  employeeAnnualSubmitValidationError,
  employeeKpiSubmitValidationError,
  employeeMidYearSubmitValidationError,
} from "@/lib/appraisal-validation";

function parseOptionalRating(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const v = Number(raw);
  if (!Number.isFinite(v)) return null;
  const r = Math.round(v);
  if (r < 1 || r > 5) return null;
  return r;
}

/**
 * The demo-manager/demo-HR fallback ("mark"/"hr") only makes sense for the
 * demo roster, where every login maps to one of those two fixed inboxes.
 * For a real SSO owner it used to apply anyway, silently routing their
 * notification to the DEMO Mark/HR account instead of their real manager -
 * a real employee's submission would show up as noise in the demo account's
 * "Pending your review" list, while their actual manager (who may not even
 * have signed in yet) never got notified at all. Reserve the demo fallback
 * for demo owners only; for a real owner with no resolvable manager, leave
 * it unassigned rather than misattributing it to Mark.
 */
function isDemoOwner(ownerUserId: string): boolean {
  return findMockUser(ownerUserId) != null;
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

/**
 * HR row normalizers. Unlike the employee/manager variants above, HR is
 * authoritative and can write every field on a row (self rating, manager
 * rating, mid-year rating, comments) in one save — HR is the admin override,
 * not a phase-gated participant.
 */
function normalizeKpisFromHr(rows: unknown[]): KpiRow[] {
  return rows.slice(0, MAX_KPIS).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      goalsAndKpis: String(r.goalsAndKpis ?? ""),
      weightPercent: Math.min(100, Math.max(0, Number(r.weightPercent) || 0)),
      dueDate: String(r.dueDate ?? ""),
      selfRating: parseOptionalRating(r.selfRating),
      managerRating: parseOptionalRating(r.managerRating),
      managerComments: String(r.managerComments ?? ""),
      midYearRating: parseMidYearRating(r.midYearRating),
      midYearComment: String(r.midYearComment ?? ""),
    };
  });
}

function normalizeCapabilitiesFromHr(rows: unknown[]): CapabilityRow[] {
  const byId = new Map<CapabilityId, CapabilityRow>();
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const id = r.id as CapabilityId;
      if (!CAPABILITY_ORDER.includes(id)) continue;
      byId.set(id, {
        id,
        selfRating: parseOptionalRating(r.selfRating),
        managerRating: parseOptionalRating(r.managerRating),
        managerComments: String(r.managerComments ?? ""),
        midYearRating: parseOptionalRating(r.midYearRating),
        midYearComment: String(r.midYearComment ?? ""),
      });
    }
  }
  return CAPABILITY_ORDER.map(
    (id) =>
      byId.get(id) ?? {
        id,
        selfRating: null,
        managerRating: null,
        managerComments: "",
        midYearRating: null,
        midYearComment: "",
      }
  );
}

const HR_STATUS_OPTIONS: AppraisalStatus[] = [
  "draft",
  "submitted",
  "reviewed",
  "completed",
];
const HR_CYCLE_STATUS_OPTIONS: CycleStatus[] = [
  "not_started",
  "kpi_created",
  "kpi_approved",
  "draft",
  "submitted",
  "completed",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const actor = await resolveActor(searchParams.get("as"));

  if (readsFromErpnext() && !actor) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  try {
    const appraisal = await getById(actor, id);
    if (!appraisal) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(appraisal);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load appraisal.";
    return NextResponse.json({ error: msg }, { status: statusForError(e) });
  }
}

/**
 * HR-only permanent delete, from the Super Admin list. Authorization here
 * matches the rest of this route's HR-side actions (e.g. hr_update): no
 * server-side role check, trusted from the client the same way the Delete
 * button itself is only rendered for `caps.canSuperAdmin`. Irreversible, so
 * the client gates this behind a confirmation dialog before ever calling it.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const actor = await resolveActor(searchParams.get("as"));

  if (writesToErpnext()) {
    // ERPNext enforces HR-only itself, against the acting identity - the
    // client-side `caps.canSuperAdmin` gate that used to be the ONLY check
    // is now a UI convenience rather than the authorization.
    if (!actor) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const result = await erpnextApiCall(
      "appraisal.delete_appraisal",
      { appraisal: id },
      undefined,
      actor.employee
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    await removeNotificationsForAppraisal(id);
    return NextResponse.json({ ok: true });
  }

  const removed = await deleteAppraisal(id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await removeNotificationsForAppraisal(id);
  return NextResponse.json({ ok: true });
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

  /**
   * ERPNext write path.
   *
   * Handled before the local branches rather than woven through them: the
   * local path stays byte-for-byte intact so unsetting the flag is a true
   * rollback, and the two never half-run against each other.
   *
   * Payload shapes differ per action - some carry rows on `data`, some on
   * the body root - so each is normalised into one WritePayload here rather
   * than teaching the writer about the wire format.
   */
  if (writesToErpnext()) {
    const { searchParams } = new URL(request.url);
    const actor = await resolveActor(searchParams.get("as"));
    if (!actor) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const current = await getById(actor, id).catch(() => null);
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const d = (data ?? {}) as Record<string, unknown>;
    const rootKpis = (body as { kpis?: unknown }).kpis;
    const rootCaps = (body as { capabilities?: unknown }).capabilities;

    /* Row payloads are matched POSITIONALLY by ERPNext, so they are merged
       onto the stored rows rather than used as-is - a client sending a
       partial or reordered list would otherwise write onto the wrong KPI. */
    const mergedKpis: KpiRow[] = current.kpis.map((k, i) => {
      const fromData = Array.isArray(d.kpis) ? (d.kpis[i] as Record<string, unknown>) : undefined;
      const fromRoot = Array.isArray(rootKpis) ? (rootKpis[i] as Record<string, unknown>) : undefined;
      const row = { ...(fromData ?? {}), ...(fromRoot ?? {}) };
      return {
        ...k,
        goalsAndKpis: typeof row.goalsAndKpis === "string" ? row.goalsAndKpis : k.goalsAndKpis,
        weightPercent:
          row.weightPercent !== undefined ? Number(row.weightPercent) || 0 : k.weightPercent,
        dueDate: typeof row.dueDate === "string" ? row.dueDate : k.dueDate,
        selfRating:
          "selfRating" in row ? parseOptionalRating(row.selfRating) : k.selfRating,
        managerRating:
          "managerRating" in row ? parseOptionalRating(row.managerRating) : k.managerRating,
        managerComments:
          typeof row.managerComments === "string" ? row.managerComments : k.managerComments,
        midYearRating:
          "midYearRating" in row ? parseMidYearRating(row.midYearRating) : k.midYearRating,
        midYearComment:
          typeof row.midYearComment === "string" ? row.midYearComment : k.midYearComment,
      };
    });

    /* A brand-new appraisal has no stored rows yet, so the employee's first
       save has to be able to ADD them, not just merge onto nothing. */
    const kpisForWrite =
      (action === "employee_save" || action === "employee_submit") && Array.isArray(d.kpis)
        ? (d.kpis as Record<string, unknown>[]).slice(0, MAX_KPIS).map((row, i) => ({
            ...(current.kpis[i] ?? {
              selfRating: null,
              managerRating: null,
              managerComments: "",
              midYearRating: null,
              midYearComment: "",
            }),
            goalsAndKpis: String(row.goalsAndKpis ?? ""),
            weightPercent: Math.min(100, Math.max(0, Number(row.weightPercent) || 0)),
            dueDate: String(row.dueDate ?? ""),
          })) as KpiRow[]
        : mergedKpis;

    const capsSource = Array.isArray(d.capabilities)
      ? (d.capabilities as Record<string, unknown>[])
      : Array.isArray(rootCaps)
        ? (rootCaps as Record<string, unknown>[])
        : null;
    const mergedCaps: CapabilityRow[] = current.capabilities.map((c) => {
      const row = capsSource?.find((r) => r?.id === c.id);
      if (!row) return c;
      return {
        ...c,
        selfRating: "selfRating" in row ? parseOptionalRating(row.selfRating) : c.selfRating,
        managerRating:
          "managerRating" in row ? parseOptionalRating(row.managerRating) : c.managerRating,
        managerComments:
          typeof row.managerComments === "string" ? row.managerComments : c.managerComments,
      };
    });

    // Same friendly submit-time messages as the local path.
    if (action === "employee_submit") {
      const err = employeeKpiSubmitValidationError(kpisForWrite);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (action === "employee_annual_submit") {
      const err = employeeAnnualSubmitValidationError(mergedKpis, mergedCaps);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (action === "employee_midyear_submit") {
      const err = employeeMidYearSubmitValidationError(mergedKpis);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    try {
      const next = await applyErpnextAction(actor, id, action as WriteAction, {
        kpis: kpisForWrite,
        capabilities: mergedCaps,
        employeeComments:
          typeof d.employeeComments === "string" ? d.employeeComments : undefined,
        managerComments:
          typeof (body as { managerComments?: unknown }).managerComments === "string"
            ? String((body as { managerComments?: unknown }).managerComments)
            : typeof d.managerComments === "string"
              ? d.managerComments
              : undefined,
        midYearManagerComments:
          typeof (body as { midYearManagerComments?: unknown }).midYearManagerComments ===
          "string"
            ? String((body as { midYearManagerComments?: unknown }).midYearManagerComments)
            : typeof d.midYearManagerComments === "string"
              ? d.midYearManagerComments
              : undefined,
        managerOverallOverride: parseOptionalRating(
          (body as { managerOverallOverride?: unknown }).managerOverallOverride ??
            d.managerOverallOverride
        ),
      });

      if (action === "employee_submit" && next.reviewingManagerId) {
        await addReviewPendingNotification({
          appraisalId: next.id,
          managerUserId: next.reviewingManagerId,
          employeeName: next.employeeName,
        });
      }
      if (action === "manager_kpi_approve" || action === "manager_submit") {
        await removeNotificationsForAppraisal(id);
      }
      return NextResponse.json(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed.";
      return NextResponse.json({ error: msg }, { status: statusForError(e) });
    }
  }

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

      /* Drafts are unlimited, but only one appraisal per employee may be
         active (submitted or further) at a time - this is the point where
         a draft becomes active, so it's the point to check. */
      const currentForOwner = await getAppraisal(id);
      if (
        currentForOwner &&
        (await hasOtherActiveAppraisal(
          currentForOwner.ownerUserId,
          id,
          currentForOwner.cycleYear
        ))
      ) {
        return NextResponse.json(
          {
            error:
              "You already have an active appraisal for this cycle. Complete or withdraw it before submitting another.",
          },
          { status: 409 }
        );
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
          ? (current.reviewingManagerId ??
              (isDemoOwner(current.ownerUserId) ? DEMO_MANAGER.id : null))
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
      if (next.reviewingManagerId) {
        await addReviewPendingNotification({
          appraisalId: next.id,
          managerUserId: next.reviewingManagerId,
          employeeName: next.employeeName,
        });
      }
      /* Also notify HR that KPIs were submitted for this cycle - only a
         meaningful target for the demo roster's single fixed HR inbox.
         Real HR has full org-wide visibility via the Super Admin list
         already; there's no single "the HR account" to notify among
         however many real HR employees exist. */
      if (
        isDemoOwner(next.ownerUserId) &&
        next.reviewingManagerId !== DEMO_HR.id
      ) {
        await addReviewPendingNotification({
          appraisalId: next.id,
          managerUserId: DEMO_HR.id,
          employeeName: next.employeeName,
        });
      }
      // First employee-side ERPNext wiring slice: mirror the employee's
      // KPI submission. Authenticates as the employee's own ERPNext
      // credentials, not the shared service account - see erpnext.ts's
      // module docstring. Best-effort, never blocks the local response.
      await mirrorKpiSubmitToErpnext(next.ownerUserId, next.kpis, next.cycleYear);
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
    // Second ERPNext wiring slice: mirror the manager's KPI approval.
    // Manager/HR-side action, safely callable under the shared service
    // account (see erpnext.ts's module docstring) - unlike the employee-
    // side actions above, which still aren't wired. Best-effort, never
    // blocks the local response.
    await mirrorKpiApproveToErpnext(next.ownerUserId, next.cycleYear);
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
    // Second employee-side ERPNext wiring slice: mirror the employee's
    // mid-year submit. Authenticates as the employee's own ERPNext
    // credentials - see erpnext.ts's module docstring. Only fires on the
    // actual finalize, not employee_midyear_save (draft-only, no ERPNext
    // equivalent, same convention as the manager-side mirrors).
    if (action === "employee_midyear_submit") {
      await mirrorMidYearEmployeeSubmitToErpnext(
        next.ownerUserId,
        next.kpis,
        next.cycleYear
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
    if (action === "employee_annual_submit" && next.reviewingManagerId) {
      await addReviewPendingNotification({
        appraisalId: next.id,
        managerUserId: next.reviewingManagerId,
        employeeName: next.employeeName,
      });
      // Third employee-side ERPNext wiring slice: mirror the employee's
      // annual self-review submit. Authenticates as the employee's own
      // ERPNext credentials - see erpnext.ts's module docstring.
      // Best-effort, never blocks the local response.
      await mirrorAnnualSelfSubmitToErpnext(
        next.ownerUserId,
        next.kpis,
        next.capabilities,
        next.cycleYear
      );
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
    // Fourth ERPNext wiring slice: mirror the manager's annual review
    // submit. Manager/HR-side, safely callable under the shared service
    // account (see erpnext.ts's module docstring). Best-effort, never
    // blocks the local response.
    await mirrorAnnualManagerSubmitToErpnext(
      next.ownerUserId,
      next.kpis,
      next.capabilities,
      next.cycleYear
    );
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
    // Fifth ERPNext wiring slice: mirror the manager's final sign-off.
    // Manager/HR-side, safely callable under the shared service account
    // (see erpnext.ts's module docstring). Best-effort, never blocks the
    // local response.
    await mirrorAppraisalCompleteToErpnext(
      next.ownerUserId,
      next.managerOverallOverride,
      next.cycleYear
    );
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
    // Third ERPNext wiring slice: mirror the manager's mid-year completion.
    // Manager/HR-side action, safely callable under the shared service
    // account (see erpnext.ts's module docstring). Only fires on the actual
    // finalize (manager_midyear_submit) - manager_midyear_save is a draft
    // write with no ERPNext equivalent (complete_mid_year always finalizes).
    // Best-effort, never blocks the local response.
    if (action === "manager_midyear_submit") {
      await mirrorMidYearCompleteToErpnext(
        next.ownerUserId,
        midYearManagerComments,
        next.cycleYear
      );
    }
    return NextResponse.json(next);
  }

  if (action === "hr_update") {
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const d = data as Record<string, unknown>;

    if (Array.isArray(d.kpis) && d.kpis.length > MAX_KPIS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_KPIS} KPIs` },
        { status: 400 }
      );
    }

    /**
     * HR is the admin override: no status/window gating. Every field is
     * optional in the payload — omitted fields keep their current value, so
     * the client can send just a status change, just content, or both.
     */
    const next = await updateAppraisal(id, (current) => {
      const kpis = Array.isArray(d.kpis)
        ? normalizeKpisFromHr(d.kpis)
        : current.kpis;
      const capabilities = Array.isArray(d.capabilities)
        ? normalizeCapabilitiesFromHr(d.capabilities)
        : current.capabilities;
      const status =
        typeof d.status === "string" &&
        HR_STATUS_OPTIONS.includes(d.status as AppraisalStatus)
          ? (d.status as AppraisalStatus)
          : current.status;
      const midYearStatus =
        typeof d.midYearStatus === "string" &&
        HR_CYCLE_STATUS_OPTIONS.includes(d.midYearStatus as CycleStatus)
          ? (d.midYearStatus as CycleStatus)
          : current.midYearStatus;
      const managerOverallOverride =
        d.managerOverallOverride === null
          ? null
          : d.managerOverallOverride !== undefined
            ? parseOptionalRating(d.managerOverallOverride)
            : current.managerOverallOverride;

      return {
        ...current,
        kpis,
        capabilities,
        employeeComments:
          typeof d.employeeComments === "string"
            ? d.employeeComments
            : current.employeeComments,
        managerComments:
          typeof d.managerComments === "string"
            ? d.managerComments
            : current.managerComments,
        midYearManagerComments:
          typeof d.midYearManagerComments === "string"
            ? d.midYearManagerComments
            : current.midYearManagerComments,
        status,
        midYearStatus,
        managerOverallOverride,
      };
    });

    if (!next) {
      return NextResponse.json({ error: "Appraisal not found" }, { status: 404 });
    }
    // Sixth ERPNext wiring slice: mirror HR's admin override via the
    // dedicated hr_override_appraisal endpoint (see erpnext.ts). HR-side,
    // safely callable under the shared service account. Best-effort, never
    // blocks the local response.
    await mirrorHrUpdateToErpnext(next.ownerUserId, {
      kpis: next.kpis,
      capabilities: next.capabilities,
      employeeComments: next.employeeComments,
      managerComments: next.managerComments,
      midYearManagerComments: next.midYearManagerComments,
      midYearStatus: next.midYearStatus,
      managerOverallOverride: next.managerOverallOverride,
    }, next.cycleYear);
    return NextResponse.json(next);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
