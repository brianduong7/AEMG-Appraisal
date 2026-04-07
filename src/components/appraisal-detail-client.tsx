"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Appraisal, KpiRow } from "@/lib/types";
import { MAX_KPIS } from "@/lib/types";
import { cloneAppraisal } from "@/lib/clone-appraisal";
import {
  employmentProfileFromUser,
} from "@/lib/mock-users";
import { useSession } from "@/contexts/session-context";
import {
  M_LEVEL_LABELS,
  capabilityDescription,
  capabilityTitle,
} from "@/lib/capability-framework";
import {
  averageCapabilityRating,
  averageKpiRating,
  overallPerformanceScore,
  sumKpiWeights,
} from "@/lib/kpi-utils";
import { RatingGuideModalTrigger } from "@/components/rating-guide-modal";
import { ratingLabel } from "@/lib/ratings";
import { entityShellClass } from "@/lib/entity-theme";
import { useRole } from "@/contexts/role-context";
import { RatingReadOnly, RatingSelect } from "@/components/rating-select";
import { RatingLegend } from "@/components/rating-legend";

function emptyKpi(): KpiRow {
  return {
    goalsAndKpis: "",
    weightPercent: 20,
    dueDate: "",
    selfRating: 3,
    managerRating: null,
    managerComments: "",
  };
}

function initialDraftForRole(
  appraisal: Appraisal,
  role: "employee" | "manager"
): Appraisal | null {
  if (appraisal.status === "draft" && role === "employee") {
    return cloneAppraisal(appraisal);
  }
  return null;
}

type ManagerKpiLine = { managerRating: number; managerComments: string };
type ManagerCapLine = { managerRating: number; managerComments: string };

export function AppraisalDetailClient({
  id,
  initialAppraisal,
}: {
  id: string;
  initialAppraisal: Appraisal;
}) {
  const { user, mode } = useSession();
  const router = useRouter();
  const { role, setRole } = useRole();
  const [appraisal, setAppraisal] = useState<Appraisal>(initialAppraisal);

  useEffect(() => {
    if (mode === "employee") setRole("employee");
    if (mode === "manager") setRole("manager");
  }, [mode, setRole]);

  useEffect(() => {
    if (!mode || (mode === "employee" && !user)) {
      router.replace("/");
    }
  }, [mode, user, router]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [employeeBanner, setEmployeeBanner] = useState(false);
  const [managerBanner, setManagerBanner] = useState(false);

  const [draft, setDraft] = useState<Appraisal | null>(() =>
    initialDraftForRole(initialAppraisal, role)
  );
  useEffect(() => {
    if (appraisal.status === "draft" && role === "employee") {
      setDraft(cloneAppraisal(appraisal));
    } else {
      setDraft(null);
    }
  }, [appraisal, role]);

  const [managerKpiDraft, setManagerKpiDraft] = useState<
    ManagerKpiLine[] | null
  >(null);
  const [managerCapDraft, setManagerCapDraft] = useState<
    ManagerCapLine[] | null
  >(null);
  const [managerReviewComments, setManagerReviewComments] = useState("");

  useEffect(() => {
    if (appraisal.status === "submitted" && role === "manager") {
      setManagerKpiDraft(
        appraisal.kpis.map((k) => ({
          managerRating: k.managerRating ?? 3,
          managerComments: k.managerComments ?? "",
        }))
      );
      setManagerCapDraft(
        appraisal.capabilities.map((c) => ({
          managerRating: c.managerRating ?? 3,
          managerComments: c.managerComments ?? "",
        }))
      );
      setManagerReviewComments(appraisal.managerComments ?? "");
    } else {
      setManagerKpiDraft(null);
      setManagerCapDraft(null);
      setManagerReviewComments("");
    }
  }, [appraisal, role]);

  const employeeEditable =
    role === "employee" && appraisal.status === "draft" && draft != null;
  const src = employeeEditable ? draft! : appraisal;
  const weightTotal = useMemo(() => sumKpiWeights(src.kpis), [src.kpis]);
  const weightsOk = Math.abs(weightTotal - 100) < 0.01;

  const kpiSelfScore = averageKpiRating(src.kpis, "self");
  const kpiMgrScore = averageKpiRating(src.kpis, "manager");
  const capSelfAvg = averageCapabilityRating(
    src.capabilities.map((c) => c.selfRating)
  );
  const capMgrAvg = averageCapabilityRating(
    src.capabilities.map((c) => c.managerRating ?? c.selfRating)
  );
  const overallSelf = overallPerformanceScore(kpiSelfScore, capSelfAvg);
  const overallMgr = overallPerformanceScore(kpiMgrScore, capMgrAvg);

  async function saveEmployee(action: "employee_save" | "employee_submit") {
    if (!draft || !user) return;
    if (user.id !== appraisal.ownerUserId) return;
    if (action === "employee_submit" && !weightsOk) {
      setFormError(`KPI weights must total 100% (currently ${weightTotal}%).`);
      return;
    }
    setBusy(true);
    setFormError(null);
    const header = employmentProfileFromUser(user);
    try {
      const res = await fetch(`/api/appraisals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          data: {
            ...header,
            kpis: draft.kpis,
            capabilities: draft.capabilities,
            employeeComments: draft.employeeComments,
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(
          typeof body?.error === "string" ? body.error : "Request failed."
        );
        return;
      }
      setAppraisal(body as Appraisal);
      if (action === "employee_submit") {
        setEmployeeBanner(true);
      }
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submitManagerReview() {
    if (!managerKpiDraft || !managerCapDraft || !appraisal) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/appraisals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manager_submit",
          kpis: managerKpiDraft,
          capabilities: managerCapDraft,
          managerComments: managerReviewComments,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(
          typeof body?.error === "string" ? body.error : "Request failed."
        );
        return;
      }
      setAppraisal(body as Appraisal);
      setManagerBanner(true);
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const isEmployee = role === "employee";
  const isManager = role === "manager";
  const employeeReadOnlyEmployee =
    isEmployee &&
    (appraisal.status === "submitted" || appraisal.status === "reviewed");
  const managerWaiting = isManager && appraisal.status === "draft";
  const managerCanReview =
    isManager &&
    appraisal.status === "submitted" &&
    managerKpiDraft != null &&
    managerCapDraft != null;
  const managerDone = isManager && appraisal.status === "reviewed";

  const identity = useMemo(() => {
    if (
      role === "employee" &&
      user &&
      appraisal.ownerUserId === user.id &&
      appraisal.status === "draft"
    ) {
      return employmentProfileFromUser(user);
    }
    return {
      employeeName: src.employeeName,
      position: src.position,
      department: src.department,
      mLevel: src.mLevel,
      managerName: src.managerName,
      entity: src.entity,
    };
  }, [
    role,
    user,
    appraisal.ownerUserId,
    appraisal.status,
    src.employeeName,
    src.position,
    src.department,
    src.mLevel,
    src.managerName,
    src.entity,
  ]);

  const levelForFramework = useMemo(() => {
    if (
      role === "employee" &&
      user &&
      appraisal.ownerUserId === user.id &&
      appraisal.status === "draft"
    ) {
      return user.mLevel;
    }
    return src.mLevel;
  }, [
    role,
    user,
    appraisal.ownerUserId,
    appraisal.status,
    src.mLevel,
  ]);

  const employeeDetailsReadOnly = true;

  const themeEntity = useMemo(() => {
    if (mode === "employee" && user && appraisal.ownerUserId === user.id) {
      return user.entity;
    }
    return appraisal.entity;
  }, [mode, user, appraisal.ownerUserId, appraisal.entity]);

  if (!mode || (mode === "employee" && !user)) {
    return (
      <div className="mx-auto flex max-w-3xl flex-1 items-center justify-center px-4 py-16 text-sm text-zinc-500">
        Redirecting to sign in…
      </div>
    );
  }

  if (
    mode === "employee" &&
    user &&
    appraisal.ownerUserId !== user.id
  ) {
    return (
      <div className="mx-auto max-w-lg flex-1 px-4 py-16">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          This appraisal belongs to another employee. Switch account or open your
          own plan from the home list.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-1 flex-col ${entityShellClass(themeEntity)}`}>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All appraisals
      </Link>

      {employeeBanner && (
        <div
          className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
          role="status"
        >
          {appraisal.reviewingManagerId ? (
            <>
              Appraisal submitted.{" "}
              <strong>Mark</strong> has an in-app notification — sign in as{" "}
              <strong>Mark (manager)</strong> on the home page to review.
            </>
          ) : (
            <>
              Appraisal submitted. Your manager{" "}
              <strong>{appraisal.managerName}</strong> is not set up as a demo
              user; in production they would be notified by email or your HR
              system.
            </>
          )}
        </div>
      )}

      {managerBanner && (
        <div
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
          role="status"
        >
          Manager review saved. Status is now <strong>reviewed</strong>.
        </div>
      )}

      <header className="mb-6 border-b border-zinc-200 pb-6 dark:border-zinc-700">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {isEmployee ? "Employee view" : "Manager view"} · Annual Performance
          Plan
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          AEMG
        </h1>
        <p className="mt-1 text-sm capitalize text-zinc-600 dark:text-zinc-400">
          Status: {appraisal.status}
        </p>
        {mode === "employee" && employeeReadOnlyEmployee && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <strong>View only</strong> — this is your appraisal; you can read it
            but not change it after submit.
          </p>
        )}
      </header>

      {formError && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{formError}</p>
      )}

      {managerWaiting && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          The employee has not submitted this appraisal yet. You can review it
          after they submit.
        </p>
      )}

      {(employeeEditable ||
        employeeReadOnlyEmployee ||
        managerCanReview ||
        managerDone ||
        (isManager && appraisal.status !== "draft")) && (
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-10">
            <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Employee details
              </h2>
              {role === "employee" &&
                user &&
                appraisal.ownerUserId === user.id &&
                appraisal.status === "draft" && (
                  <p className="mb-4 text-xs text-zinc-600 dark:text-zinc-400">
                    Prefilled from your sign-in profile (HR directory). Update
                    your account in a real system; here it stays read-only.
                  </p>
                )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Employee name"
                  readOnly={employeeDetailsReadOnly}
                  value={identity.employeeName}
                  onChange={() => {}}
                />
                <Field
                  label="Position"
                  readOnly={employeeDetailsReadOnly}
                  value={identity.position}
                  onChange={() => {}}
                />
                <Field
                  label="Department"
                  readOnly={employeeDetailsReadOnly}
                  value={identity.department}
                  onChange={() => {}}
                />
                <Field
                  label="Manager"
                  readOnly={employeeDetailsReadOnly}
                  value={identity.managerName}
                  onChange={() => {}}
                />
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    M level (1–10)
                  </label>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    {M_LEVEL_LABELS[identity.mLevel] ?? `L${identity.mLevel}`}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Entity
                  </label>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200">
                    {identity.entity}
                  </p>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Key Performance Indicators
                </h2>
                <RatingGuideModalTrigger label="Rating definitions" />
              </div>
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                Up to {MAX_KPIS} KPIs: goals, weights (%), due dates, and
                ratings. Weights must total 100% for submit. The KPI score below
                is the <strong>average</strong> of row ratings (not weight ×
                rating).
              </p>
              <div
                className={`mb-3 text-sm ${weightsOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-200"}`}
              >
                Total weight: <strong>{weightTotal}%</strong>
                {!weightsOk && employeeEditable && (
                  <span> — adjust to 100% before submit.</span>
                )}
              </div>
              <div className="space-y-4">
                {src.kpis.map((kpi, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500">
                        KPI {i + 1}
                      </span>
                      {employeeEditable && draft!.kpis.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline dark:text-red-400"
                          onClick={() =>
                            setDraft({
                              ...draft!,
                              kpis: draft!.kpis.filter((_, j) => j !== i),
                            })
                          }
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mb-3">
                      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Goals | KPIs
                      </label>
                      {employeeEditable ? (
                        <textarea
                          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                          rows={3}
                          value={kpi.goalsAndKpis}
                          onChange={(e) => {
                            if (!draft) return;
                            const kpis = [...draft.kpis];
                            kpis[i] = {
                              ...kpis[i],
                              goalsAndKpis: e.target.value,
                            };
                            setDraft({ ...draft, kpis });
                          }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                          {kpi.goalsAndKpis || "—"}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Weight (%)
                        </label>
                        {employeeEditable ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                            value={kpi.weightPercent || ""}
                            onChange={(e) => {
                              if (!draft) return;
                              const kpis = [...draft.kpis];
                              kpis[i] = {
                                ...kpis[i],
                                weightPercent: Number(e.target.value) || 0,
                              };
                              setDraft({ ...draft, kpis });
                            }}
                          />
                        ) : (
                          <p className="text-sm text-zinc-800 dark:text-zinc-200">
                            {kpi.weightPercent}%
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Due date
                        </label>
                        {employeeEditable ? (
                          <input
                            type="date"
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                            value={kpi.dueDate}
                            onChange={(e) => {
                              if (!draft) return;
                              const kpis = [...draft.kpis];
                              kpis[i] = {
                                ...kpis[i],
                                dueDate: e.target.value,
                              };
                              setDraft({ ...draft, kpis });
                            }}
                          />
                        ) : (
                          <p className="text-sm text-zinc-800 dark:text-zinc-200">
                            {kpi.dueDate || "—"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Employee self rating
                        </label>
                        {employeeEditable ? (
                          <RatingSelect
                            value={kpi.selfRating}
                            onChange={(n) => {
                              if (!draft) return;
                              const kpis = [...draft.kpis];
                              kpis[i] = { ...kpis[i], selfRating: n };
                              setDraft({ ...draft, kpis });
                            }}
                          />
                        ) : (
                          <RatingReadOnly value={kpi.selfRating} />
                        )}
                      </div>
                      {(isManager || appraisal.status !== "draft") && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Manager rating
                          </label>
                          {managerCanReview && managerKpiDraft ? (
                            <RatingSelect
                              value={managerKpiDraft[i].managerRating}
                              onChange={(n) => {
                                const next = [...managerKpiDraft];
                                next[i] = { ...next[i], managerRating: n };
                                setManagerKpiDraft(next);
                              }}
                            />
                          ) : kpi.managerRating != null ? (
                            <RatingReadOnly value={kpi.managerRating} />
                          ) : (
                            <span className="text-sm text-zinc-400">—</span>
                          )}
                        </div>
                      )}
                    </div>
                    {(isManager || appraisal.status !== "draft") && (
                      <div className="mt-4">
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Manager comments (KPI)
                        </label>
                        {managerCanReview && managerKpiDraft ? (
                          <textarea
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                            rows={2}
                            value={managerKpiDraft[i].managerComments}
                            onChange={(e) => {
                              const next = [...managerKpiDraft];
                              next[i] = {
                                ...next[i],
                                managerComments: e.target.value,
                              };
                              setManagerKpiDraft(next);
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                            {kpi.managerComments || "—"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {employeeEditable && draft!.kpis.length < MAX_KPIS && (
                <button
                  type="button"
                  className="mt-4 text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
                  onClick={() =>
                    setDraft({
                      ...draft!,
                      kpis: [...draft!.kpis, emptyKpi()],
                    })
                  }
                >
                  + Add KPI ({draft!.kpis.length}/{MAX_KPIS})
                </button>
              )}
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                <p>
                  <span className="font-medium">
                    KPI performance (average of ratings)
                  </span>{" "}
                  — Self:{" "}
                  {kpiSelfScore != null
                    ? `${kpiSelfScore.toFixed(2)} (${ratingLabel(Math.min(5, Math.max(1, Math.round(kpiSelfScore))))})`
                    : "—"}
                </p>
                {(isManager || appraisal.status !== "draft") && (
                  <p className="mt-1">
                    Manager:{" "}
                    {kpiMgrScore != null
                      ? `${kpiMgrScore.toFixed(2)} (${ratingLabel(Math.min(5, Math.max(1, Math.round(kpiMgrScore))))})`
                      : "—"}
                  </p>
                )}
              </div>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Capability and skill development
                </h2>
                <RatingGuideModalTrigger label="Rating definitions" />
              </div>
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                Descriptions follow <strong>Appendix 1 — Capability Framework</strong>{" "}
                for the selected M level.
              </p>
              <div className="space-y-4">
                {src.capabilities.map((cap, i) => (
                  <div
                    key={cap.id}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {capabilityTitle(cap.id)}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {capabilityDescription(levelForFramework, cap.id)}
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Employee rating
                        </label>
                        {employeeEditable ? (
                          <RatingSelect
                            value={cap.selfRating}
                            onChange={(n) => {
                              if (!draft) return;
                              const caps = [...draft.capabilities];
                              caps[i] = { ...caps[i], selfRating: n };
                              setDraft({ ...draft, capabilities: caps });
                            }}
                          />
                        ) : (
                          <RatingReadOnly value={cap.selfRating} />
                        )}
                      </div>
                      {(isManager || appraisal.status !== "draft") && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Manager rating
                          </label>
                          {managerCanReview && managerCapDraft ? (
                            <RatingSelect
                              value={managerCapDraft[i].managerRating}
                              onChange={(n) => {
                                const next = [...managerCapDraft];
                                next[i] = { ...next[i], managerRating: n };
                                setManagerCapDraft(next);
                              }}
                            />
                          ) : cap.managerRating != null ? (
                            <RatingReadOnly value={cap.managerRating} />
                          ) : (
                            <span className="text-sm text-zinc-400">—</span>
                          )}
                        </div>
                      )}
                    </div>
                    {(isManager || appraisal.status !== "draft") && (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Manager comments
                        </label>
                        {managerCanReview && managerCapDraft ? (
                          <textarea
                            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                            rows={2}
                            value={managerCapDraft[i].managerComments}
                            onChange={(e) => {
                              const next = [...managerCapDraft];
                              next[i] = {
                                ...next[i],
                                managerComments: e.target.value,
                              };
                              setManagerCapDraft(next);
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                            {cap.managerComments || "—"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                <p>
                  <span className="font-medium">Capability average</span> — Self:{" "}
                  {capSelfAvg != null
                    ? `${capSelfAvg.toFixed(2)} (${ratingLabel(Math.min(5, Math.max(1, Math.round(capSelfAvg))))})`
                    : "—"}
                </p>
                {(isManager || appraisal.status !== "draft") && (
                  <p className="mt-1">
                    Manager:{" "}
                    {capMgrAvg != null
                      ? `${capMgrAvg.toFixed(2)} (${ratingLabel(Math.min(5, Math.max(1, Math.round(capMgrAvg))))})`
                      : "—"}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Overall final performance rating
              </h2>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                Average of KPI row ratings and capability average (both 1–5),
                then averaged together.
              </p>
              <p className="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Self:{" "}
                {overallSelf != null
                  ? `${overallSelf.toFixed(2)} — ${ratingLabel(Math.min(5, Math.max(1, Math.round(overallSelf))))}`
                  : "—"}
              </p>
              {(isManager || appraisal.status !== "draft") && (
                <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  Manager:{" "}
                  {overallMgr != null
                    ? `${overallMgr.toFixed(2)} — ${ratingLabel(Math.min(5, Math.max(1, Math.round(overallMgr))))}`
                    : "—"}
                </p>
              )}
            </section>

            <section className="space-y-4">
              <BigField
                label="Employee comments"
                readOnly={!employeeEditable}
                value={
                  employeeEditable ? draft!.employeeComments : appraisal.employeeComments
                }
                onChange={(v) =>
                  employeeEditable && draft && setDraft({ ...draft, employeeComments: v })
                }
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Manager comments
                </label>
                {managerCanReview ? (
                  <textarea
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                    rows={5}
                    value={managerReviewComments}
                    onChange={(e) => setManagerReviewComments(e.target.value)}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                    {appraisal.managerComments || "—"}
                  </p>
                )}
              </div>
            </section>

            {employeeEditable && (
              <div className="flex flex-wrap gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-700">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                  onClick={() => saveEmployee("employee_save")}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy || !weightsOk}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  onClick={() => saveEmployee("employee_submit")}
                  title={
                    !weightsOk
                      ? "KPI weights must total 100%"
                      : undefined
                  }
                >
                  Submit appraisal
                </button>
              </div>
            )}

            {employeeReadOnlyEmployee && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This appraisal was submitted. You cannot edit it anymore.
              </p>
            )}

            {managerCanReview && (
              <div className="border-t border-zinc-200 pt-6 dark:border-zinc-700">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  onClick={() => submitManagerReview()}
                >
                  Submit manager review
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0 lg:w-64">
            <RatingLegend />
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              9-box and other talent tools can be layered on in a later version.
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {readOnly ? (
        <p className="text-sm text-zinc-800 dark:text-zinc-200">{value || "—"}</p>
      ) : (
        <input
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function BigField({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      {readOnly ? (
        <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
          {value || "—"}
        </p>
      ) : (
        <textarea
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
