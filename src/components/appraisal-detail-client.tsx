"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Appraisal, KpiRow } from "@/lib/types";
import { MAX_KPIS } from "@/lib/types";
import { cloneAppraisal } from "@/lib/clone-appraisal";
import {
  DEMO_COMPANY_NAME,
  employmentProfileFromUser,
  overviewProfileForAppraisal,
} from "@/lib/mock-users";
import { HrReadonlyField } from "@/components/hr-readonly-field";
import { useSession } from "@/contexts/session-context";
import {
  M_LEVEL_LABELS,
  capabilityDescription,
  capabilityTitle,
} from "@/lib/capability-framework";
import {
  averageCapabilityRating,
  capabilityAverageFromDraft,
  capabilitySelfAverage,
  overallPerformanceScore,
  formatKpiRowWeightedGoalScore,
  sumKpiWeights,
  weightedKpiScore,
  weightedKpiScoreFromManagerDraft,
} from "@/lib/kpi-utils";
import { RatingGuideModalTrigger } from "@/components/rating-guide-modal";
import { ratingLabel } from "@/lib/ratings";
import { useRole } from "@/contexts/role-context";
import { RatingReadOnly, RatingSelect } from "@/components/rating-select";
import {
  RatingLegendModal,
} from "@/components/rating-legend";
import { CapabilityAppendixModal } from "@/components/capability-appendix-reference";
import {
  PerformanceNineBoxModal,
} from "@/components/performance-nine-box-reference";
import {
  readAppraisalBootstrap,
  saveAppraisalBootstrap,
} from "@/lib/appraisal-bootstrap";
import { HeaderNotificationsButton } from "@/components/header-notifications-button";

function emptyKpi(): KpiRow {
  return {
    goalsAndKpis: "",
    weightPercent: 0,
    dueDate: "",
    selfRating: null,
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

type ManagerKpiLine = { managerRating: number | null };
type ManagerCapLine = { managerRating: number | null };

export function AppraisalDetailClient({
  id,
  initialAppraisal,
}: {
  id: string;
  initialAppraisal: Appraisal | null;
}) {
  const { user, mode } = useSession();
  const router = useRouter();
  const [appraisal, setAppraisal] = useState<Appraisal | null>(
    initialAppraisal
  );
  const [loadState, setLoadState] = useState<
    "loading" | "ready" | "notfound"
  >(() => (initialAppraisal ? "ready" : "loading"));

  useEffect(() => {
    if (!mode || (mode === "employee" && !user)) {
      router.replace("/");
    }
  }, [mode, user, router]);

  useEffect(() => {
    if (initialAppraisal) {
      setAppraisal(initialAppraisal);
      setLoadState("ready");
      return;
    }
    let cancelled = false;
    (async () => {
      const fromSession = readAppraisalBootstrap(id);
      if (!cancelled && fromSession?.id === id) {
        setAppraisal(fromSession);
        setLoadState("ready");
        return;
      }
      try {
        const res = await fetch(`/api/appraisals/${id}`);
        if (!cancelled && res.ok) {
          const data = (await res.json()) as Appraisal;
          setAppraisal(data);
          saveAppraisalBootstrap(data);
          setLoadState("ready");
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoadState("notfound");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, initialAppraisal]);

  if (!mode || (mode === "employee" && !user)) {
    return (
      <div className="mx-auto flex max-w-3xl flex-1 items-center justify-center px-4 py-16 text-sm text-zinc-500">
        Redirecting to sign in…
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-1 items-center justify-center px-4 py-16 text-sm text-zinc-500">
        Loading appraisal…
      </div>
    );
  }

  if (loadState === "notfound" || !appraisal) {
    return (
      <div className="mx-auto max-w-lg flex-1 px-4 py-16">
        <p className="text-sm text-black">
          This appraisal could not be found. On serverless hosting without a
          shared database, the server that serves this page may not see data
          created on another instance. If you just created it, try again from
          the home list, or use persistent storage in production.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-black underline"
        >
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <AppraisalDetailInner
      id={id}
      appraisal={appraisal}
      setAppraisal={(next) => setAppraisal(next)}
    />
  );
}

function AppraisalDetailInner({
  id,
  appraisal,
  setAppraisal,
}: {
  id: string;
  appraisal: Appraisal;
  setAppraisal: (next: Appraisal) => void;
}) {
  const { user, mode, managerProfile } = useSession();
  const { role, setRole } = useRole();

  useEffect(() => {
    if (mode === "employee") setRole("employee");
    if (mode === "manager") setRole("manager");
  }, [mode, setRole]);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [employeeBanner, setEmployeeBanner] = useState(false);
  const [managerBanner, setManagerBanner] = useState<
    null | "saved" | "updated"
  >(null);
  const [completeAppraisalDemoBanner, setCompleteAppraisalDemoBanner] =
    useState(false);

  useEffect(() => {
    setCompleteAppraisalDemoBanner(false);
  }, [id]);

  const [draft, setDraft] = useState<Appraisal | null>(() =>
    initialDraftForRole(appraisal, role)
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
  const [activeTab, setActiveTab] = useState<
    "overview" | "kpi" | "capability" | "overall"
  >("overview");
  const [ratingLegendOpen, setRatingLegendOpen] = useState(false);
  const [nineBoxModalOpen, setNineBoxModalOpen] = useState(false);
  const [capabilityAppendixOpen, setCapabilityAppendixOpen] = useState(false);

  const appraisalCycleYear = useMemo(() => new Date().getFullYear(), []);
  const appraisalSeries = useMemo(
    () => `HR-APR-.${appraisalCycleYear}.-`,
    [appraisalCycleYear]
  );

  useEffect(() => {
    if (
      role === "manager" &&
      (appraisal.status === "submitted" || appraisal.status === "reviewed")
    ) {
      setManagerKpiDraft(
        appraisal.kpis.map((k) => ({
          managerRating: k.managerRating ?? null,
        }))
      );
      setManagerCapDraft(
        appraisal.capabilities.map((c) => ({
          managerRating: c.managerRating ?? null,
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

  const kpiSelfScore = weightedKpiScore(src.kpis, "self");
  const capSelfAvg = capabilitySelfAverage(src.capabilities);

  const employeeSubmitReady = useMemo(() => {
    if (!draft) return false;
    if (!weightsOk) return false;
    if (!draft.kpis.every((k) => (Number(k.weightPercent) || 0) > 0)) {
      return false;
    }
    if (!draft.kpis.every((k) => k.selfRating != null)) return false;
    if (!draft.capabilities.every((c) => c.selfRating != null)) return false;
    return true;
  }, [draft, weightsOk]);

  const managerSubmitReady = useMemo(() => {
    if (!managerKpiDraft || !managerCapDraft) return false;
    return (
      managerKpiDraft.every((d) => d.managerRating != null) &&
      managerCapDraft.every((d) => d.managerRating != null)
    );
  }, [managerKpiDraft, managerCapDraft]);

  async function saveEmployee(action: "employee_save" | "employee_submit") {
    if (!draft || !user) return;
    if (user.id !== appraisal.ownerUserId) return;
    if (action === "employee_submit" && !employeeSubmitReady) {
      setFormError(
        "Select a self rating for every KPI and capability, and set each KPI weight above 0% so the total is 100%."
      );
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
      const next = body as Appraisal;
      setAppraisal(next);
      saveAppraisalBootstrap(next);
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
    if (!managerSubmitReady) {
      setFormError(
        "Select a manager rating for every KPI and capability before submitting."
      );
      return;
    }
    const wasAlreadyReviewed = appraisal.status === "reviewed";
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
      const next = body as Appraisal;
      setAppraisal(next);
      saveAppraisalBootstrap(next);
      setManagerBanner(wasAlreadyReviewed ? "updated" : "saved");
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
    (appraisal.status === "submitted" || appraisal.status === "reviewed") &&
    managerKpiDraft != null &&
    managerCapDraft != null;

  const kpiMgrScore = useMemo(() => {
    if (
      managerCanReview &&
      managerKpiDraft &&
      managerKpiDraft.length === appraisal.kpis.length
    ) {
      return weightedKpiScoreFromManagerDraft(
        appraisal.kpis,
        managerKpiDraft.map((d) => d.managerRating)
      );
    }
    return weightedKpiScore(src.kpis, "manager");
  }, [managerCanReview, managerKpiDraft, appraisal.kpis, src.kpis]);

  const capMgrAvg = useMemo(() => {
    if (
      managerCanReview &&
      managerCapDraft &&
      managerCapDraft.length === appraisal.capabilities.length
    ) {
      return capabilityAverageFromDraft(
        managerCapDraft.map((c) => c.managerRating)
      );
    }
    const merged = src.capabilities.map((c) => c.managerRating ?? c.selfRating);
    if (merged.some((n) => n == null)) return null;
    return averageCapabilityRating(merged as number[]);
  }, [managerCanReview, managerCapDraft, appraisal.capabilities, src.capabilities]);

  const overallSelf = overallPerformanceScore(kpiSelfScore, capSelfAvg);
  const overallMgr = overallPerformanceScore(kpiMgrScore, capMgrAvg);

  const statusBadge =
    appraisal.status === "draft"
      ? {
          label: "Draft",
          className:
            "rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900",
        }
      : appraisal.status === "submitted"
        ? {
            label: "Submitted",
            className:
              "rounded-md bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900",
          }
        : {
            label: "Reviewed",
            className:
              "rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900",
          };

  const chromeInitial =
    (mode === "employee" && user?.employeeName?.[0]?.toUpperCase()) ||
    (mode === "manager" && managerProfile?.displayName?.[0]?.toUpperCase()) ||
    "A";

  const inputEnterprise =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";

  const identity = useMemo(() => {
    const fallback = {
      employeeName: src.employeeName,
      englishName: src.englishName,
      position: src.position,
      department: src.department,
      mLevel: src.mLevel,
      managerName: src.managerName,
      entity: src.entity,
    };
    if (
      role === "employee" &&
      user &&
      appraisal.ownerUserId === user.id &&
      appraisal.status === "draft"
    ) {
      return employmentProfileFromUser(user);
    }
    return overviewProfileForAppraisal(appraisal.ownerUserId, fallback);
  }, [
    role,
    user,
    appraisal.ownerUserId,
    appraisal.status,
    src.employeeName,
    src.englishName,
    src.position,
    src.department,
    src.mLevel,
    src.managerName,
    src.entity,
  ]);

  const levelForFramework = identity.mLevel;

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
        <p className="text-sm text-black">
          This appraisal belongs to another employee. Switch account or open your
          own plan from the home list.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-black underline"
        >
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-black">
      <header className="border-b border-zinc-200/80 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <nav
            className="text-xs text-zinc-500"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="hover:text-black"
            >
              Performance
            </Link>
            <span className="mx-1.5 text-zinc-300">/</span>
            <span className="font-medium text-black">
              Appraisal
            </span>
          </nav>
          <div className="ml-auto flex min-w-48 max-w-xl flex-1 items-center justify-end gap-3">
            <input
              type="search"
              readOnly
              placeholder="Search or type a command (⌘ + G)"
              className="hidden w-full max-w-md rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 md:block"
              aria-hidden
            />
            <HeaderNotificationsButton />
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
              aria-hidden
            >
              {chromeInitial}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[min(100%,96rem)] flex-1 px-6 py-8">
      <Link
        href="/"
        className="mb-6 inline-block text-sm font-medium text-zinc-600 hover:text-black"
      >
        ← All appraisals
      </Link>

      {employeeBanner && (
        <div
          className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
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

      {managerBanner === "saved" && (
        <div
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Manager review saved. Status is now <strong>reviewed</strong>.
        </div>
      )}
      {managerBanner === "updated" && (
        <div
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Manager review updated. Ratings and comments were saved.
        </div>
      )}
      {completeAppraisalDemoBanner && (
        <div
          className="mb-6 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
          role="status"
        >
          <strong>Appraisal complete.</strong> In a live HR system this would
          close the cycle (e.g. lock records, trigger payroll or talent steps).
          This demo does not store anything further.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-black sm:text-2xl">
              Appraisal
            </h1>
            <span className={statusBadge.className}>{statusBadge.label}</span>
            <span className="text-xs text-zinc-500">
              {isEmployee ? "Employee" : "Manager"} · {identity.employeeName}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Overview fields come from your F3 / HR account setup and are read-only
            here.
          </p>
          {mode === "employee" && employeeReadOnlyEmployee && (
            <p className="mt-2 text-sm text-zinc-600">
              <strong>View only</strong> — submitted appraisals cannot be changed.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {employeeEditable && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm disabled:opacity-50"
                onClick={() => saveEmployee("employee_save")}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy || !employeeSubmitReady}
                title={
                  !employeeSubmitReady
                    ? "Complete all ratings and KPI weights (100% total) to submit"
                    : undefined
                }
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                onClick={() => saveEmployee("employee_submit")}
              >
                Submit appraisal
              </button>
            </>
          )}
          {managerCanReview && (
            <>
              <button
                type="button"
                disabled={busy || !managerSubmitReady}
                title={
                  !managerSubmitReady
                    ? "Select a manager rating for every KPI and capability"
                    : undefined
                }
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50"
                onClick={() => submitManagerReview()}
              >
                {appraisal.status === "reviewed"
                  ? "Update manager review"
                  : "Submit manager review"}
              </button>
              {appraisal.status === "reviewed" && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-black shadow-sm disabled:opacity-50"
                  onClick={() => setCompleteAppraisalDemoBanner(true)}
                >
                  Complete Appraisal
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-zinc-200">
        {(
          [
            ["overview", "Overview"],
            ["kpi", "KPI"],
            ["capability", "Capability"],
            ["overall", "Overall"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              activeTab === id
                ? "border-zinc-900 text-black"
                : "border-transparent text-zinc-500 hover:text-black"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {formError && (
        <p className="mb-4 text-sm text-red-600">{formError}</p>
      )}

      {managerWaiting && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The employee has not submitted this appraisal yet. You can review KPI
          and capability tabs after they submit.
        </p>
      )}

        <div className="w-full">
          <div className="min-w-0 w-full space-y-8">
            {activeTab === "capability" ? (
              <>
                <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
                  <section>
            {managerWaiting ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Capability ratings unlock after the employee submits the
                  appraisal.
                </p>
            ) : (
              <>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold text-black">
                  Capability and skill development
                </h2>
                <RatingGuideModalTrigger label="Rating definitions" />
              </div>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-600">
                  Descriptions are prefilled for your M level. Open the appendix
                  for the full M1–M10 framework.
                </p>
                <button
                  type="button"
                  onClick={() => setCapabilityAppendixOpen(true)}
                  className="shrink-0 rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
                >
                  Appendix 1 — AEMG Capability Framework
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full min-w-4xl border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <th className="w-12 px-2 py-2.5" scope="col">
                        No.
                      </th>
                      <th className="min-w-36 px-2 py-2.5" scope="col">
                        Capability
                      </th>
                      <th className="min-w-[18rem] px-2 py-2.5" scope="col">
                        Description
                      </th>
                      <th className="min-w-36 px-2 py-2.5" scope="col">
                        Employee rating{" "}
                        <span className="font-normal text-red-600">*</span>
                      </th>
                      {(isManager || appraisal.status !== "draft") && (
                        <th className="min-w-36 px-2 py-2.5" scope="col">
                          Manager rating
                          {managerCanReview && (
                            <span className="font-normal text-red-600"> *</span>
                          )}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {src.capabilities.map((cap, i) => (
                      <tr
                        key={cap.id}
                        className="border-b border-zinc-100 align-top last:border-b-0"
                      >
                        <td className="px-2 py-2 tabular-nums text-zinc-600">
                          {i + 1}
                        </td>
                        <td className="px-2 py-2 font-medium text-black">
                          {capabilityTitle(cap.id)}
                        </td>
                        <td className="px-2 py-2 text-sm leading-relaxed text-black">
                          {capabilityDescription(levelForFramework, cap.id)}
                        </td>
                        <td className="px-2 py-2">
                          {employeeEditable ? (
                            <RatingSelect
                              className="[&_span]:hidden"
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
                        </td>
                        {(isManager || appraisal.status !== "draft") && (
                          <td className="px-2 py-2">
                            {managerCanReview && managerCapDraft ? (
                              <RatingSelect
                                className="[&_span]:hidden"
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
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
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
              </>
            )}
                  </section>
                </div>
                {!managerWaiting && (
                  <ReferenceGuideButtons
                    onRatingLegend={() => setRatingLegendOpen(true)}
                    onNineBox={() => setNineBoxModalOpen(true)}
                  />
                )}
              </>
            ) : activeTab === "kpi" ? (
              <>
                <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <section>
              {managerWaiting ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  KPIs and manager ratings are available after the employee
                  submits this appraisal.
                </p>
              ) : (
              <>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold text-black">
                  Key Performance Indicators
                </h2>
                <RatingGuideModalTrigger label="Rating definitions" />
              </div>
              <p className="mb-4 text-sm text-zinc-600">
                Up to {MAX_KPIS} KPIs in a list view: KRA, weight (%), due date,
                and ratings. The KPI score below is{" "}
                <strong>weighted</strong>: each row contributes{" "}
                <strong>weight% × rating</strong>, summed and divided by total
                weight% (1–5 scale).
              </p>
              <div
                className={`mb-3 text-sm ${weightsOk ? "text-emerald-700" : "text-amber-800"}`}
              >
                Total weight: <strong>{weightTotal}%</strong>
                {!weightsOk && employeeEditable && (
                  <span> — adjust to 100% before submit.</span>
                )}
                {employeeEditable &&
                  draft!.kpis.some((k) => (Number(k.weightPercent) || 0) <= 0) && (
                    <span className="ml-1">
                      Each KPI needs a weight greater than 0%.
                    </span>
                  )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full min-w-4xl border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <th className="w-10 px-2 py-2.5" scope="col">
                        <span className="sr-only">Select</span>
                        <input
                          type="checkbox"
                          disabled
                          className="rounded border-zinc-300"
                          aria-hidden
                        />
                      </th>
                      <th className="w-12 px-2 py-2.5" scope="col">
                        No.
                      </th>
                      <th className="min-w-56 px-2 py-2.5" scope="col">
                        KRA <span className="text-red-600">*</span>
                      </th>
                      <th className="w-24 px-2 py-2.5" scope="col">
                        Weight (%) <span className="text-red-600">*</span>
                      </th>
                      <th className="w-36 px-2 py-2.5" scope="col">
                        Due date
                      </th>
                      <th className="min-w-36 px-2 py-2.5" scope="col">
                        Employee rating{" "}
                        <span className="text-red-600">*</span>
                      </th>
                      <th className="w-32 px-2 py-2.5 text-right" scope="col">
                        Goal score (weighted)
                      </th>
                      {(isManager || appraisal.status !== "draft") && (
                        <th className="min-w-36 px-2 py-2.5" scope="col">
                          Manager rating
                          {managerCanReview && (
                            <span className="text-red-600"> *</span>
                          )}
                        </th>
                      )}
                      {employeeEditable && (
                        <th className="w-16 px-2 py-2.5" scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {src.kpis.map((kpi, i) => (
                      <tr
                        key={i}
                        className="border-b border-zinc-100 align-top last:border-b-0"
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            disabled
                            className="rounded border-zinc-300"
                            aria-hidden
                          />
                        </td>
                        <td className="px-2 py-2 tabular-nums text-zinc-600">
                          {i + 1}
                        </td>
                        <td className="px-2 py-2">
                          {employeeEditable ? (
                            <textarea
                              className={`${inputEnterprise} min-h-18 resize-y text-sm`}
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
                            <p className="whitespace-pre-wrap text-sm text-black">
                              {kpi.goalsAndKpis || "—"}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {employeeEditable ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className={`w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-black shadow-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200 ${
                                (Number(kpi.weightPercent) || 0) <= 0
                                  ? "border-amber-400 focus:border-amber-500 focus:ring-amber-200"
                                  : ""
                              }`}
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
                            <span className="tabular-nums text-black">
                              {kpi.weightPercent}%
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {employeeEditable ? (
                            <input
                              type="date"
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-black shadow-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
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
                            <span className="text-black">
                              {kpi.dueDate || "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {employeeEditable ? (
                            <RatingSelect
                              className="[&_span]:hidden"
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
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs text-zinc-700">
                          {formatKpiRowWeightedGoalScore(
                            kpi.weightPercent,
                            kpi.selfRating
                          )}
                        </td>
                        {(isManager || appraisal.status !== "draft") && (
                          <td className="px-2 py-2">
                            {managerCanReview && managerKpiDraft ? (
                              <RatingSelect
                                className="[&_span]:hidden"
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
                          </td>
                        )}
                        {employeeEditable && (
                          <td className="px-2 py-2 text-center">
                            {draft!.kpis.length > 1 ? (
                              <button
                                type="button"
                                className="text-xs font-medium text-red-600 hover:underline"
                                onClick={() =>
                                  setDraft({
                                    ...draft!,
                                    kpis: draft!.kpis.filter((_, j) => j !== i),
                                  })
                                }
                              >
                                Remove
                              </button>
                            ) : (
                              <span className="text-zinc-300">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {employeeEditable && draft!.kpis.length < MAX_KPIS && (
                <button
                  type="button"
                  className="mt-2 rounded border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-200/80"
                  onClick={() =>
                    setDraft({
                      ...draft!,
                      kpis: [...draft!.kpis, emptyKpi()],
                    })
                  }
                >
                  Add Row ({draft!.kpis.length}/{MAX_KPIS})
                </button>
              )}
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p>
                  <span className="font-medium">
                    KPI performance (weighted score)
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
              </>
              )}
            </section>
                </div>
                {!managerWaiting && (
                  <ReferenceGuideButtons
                    onRatingLegend={() => setRatingLegendOpen(true)}
                    onNineBox={() => setNineBoxModalOpen(true)}
                  />
                )}
              </>
            ) : (
            <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            {activeTab === "overview" && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-black">
                  Overview
                </h2>
                <div className="grid gap-5 sm:grid-cols-2">
                  <HrReadonlyField
                    label="Series"
                    value={appraisalSeries}
                    required
                  />
                  <HrReadonlyField
                    label="Company"
                    value={DEMO_COMPANY_NAME}
                    required
                  />
                  <HrReadonlyField
                    label="Employee"
                    value={identity.employeeName}
                    required
                  />
                  <HrReadonlyField
                    label="English name"
                    value={identity.englishName}
                    required
                  />
                  <HrReadonlyField
                    label="Appraisal cycle"
                    value={`Annual ${appraisalCycleYear}`}
                    required
                  />
                  <HrReadonlyField
                    label="M level"
                    value={
                      M_LEVEL_LABELS[identity.mLevel] ?? `L${identity.mLevel}`
                    }
                  />
                  <HrReadonlyField
                    label="Entity"
                    value={identity.entity}
                  />
                  <HrReadonlyField
                    label="Position"
                    value={identity.position}
                  />
                  <HrReadonlyField
                    label="Manager"
                    value={identity.managerName}
                  />
                  <HrReadonlyField
                    label="Department"
                    value={identity.department}
                  />
                </div>
              </div>
            )}

            {activeTab === "overall" && (
            <section className="space-y-8">
              <div>
                <h2 className="mb-4 text-lg font-semibold text-black">
                  Overall
                </h2>
                <p className="mb-4 text-sm text-zinc-600">
                  {isEmployee ? (
                    <>
                      Your overall score blends weighted KPI and capability
                      averages.
                      Your manager&apos;s overall rating and comments are added
                      after you submit, then appear below as read-only.
                    </>
                  ) : (
                    <>
                      Summary of weighted KPI and capability results, plus
                      comments. Manager ratings are entered on the KPI and
                      Capability tabs.
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
                <h3 className="text-base font-semibold text-black">
                  Overall performance rating
                </h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Weighted KPI score and capability average (each on a 1–5
                  scale), then averaged together for overall.
                </p>
                <p className="mt-3 text-sm text-black">
                  <span className="font-medium">
                    {isEmployee
                      ? "KPI weighted score (self):"
                      : "KPI weighted score (employee, self):"}
                  </span>{" "}
                  {kpiSelfScore != null
                    ? ratingLabel(Math.min(5, Math.max(1, Math.round(kpiSelfScore))))
                    : "—"}
                </p>
                <p className="mt-1 text-sm text-black">
                  <span className="font-medium">
                    {isEmployee
                      ? "Capability average (self):"
                      : "Capability average (employee, self):"}
                  </span>{" "}
                  {capSelfAvg != null
                    ? ratingLabel(Math.min(5, Math.max(1, Math.round(capSelfAvg))))
                    : "—"}
                </p>
                <p className="mt-3 text-base font-semibold text-black">
                  {isEmployee ? "Your overall (self):" : "Employee overall (self):"}{" "}
                  {overallSelf != null
                    ? ratingLabel(Math.min(5, Math.max(1, Math.round(overallSelf))))
                    : "—"}
                </p>

                {isManager && !managerWaiting && (
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <p className="text-sm text-zinc-600">
                      Manager view: figures below use your ratings from the KPI and
                      Capability tabs (including while you complete the review).
                    </p>
                    <p className="mt-3 text-sm text-black">
                      <span className="font-medium">
                        KPI weighted score (manager):
                      </span>{" "}
                      {kpiMgrScore != null
                        ? ratingLabel(Math.min(5, Math.max(1, Math.round(kpiMgrScore))))
                        : "—"}
                    </p>
                    <p className="mt-1 text-sm text-black">
                      <span className="font-medium">
                        Capability average (manager):
                      </span>{" "}
                      {capMgrAvg != null
                        ? ratingLabel(Math.min(5, Math.max(1, Math.round(capMgrAvg))))
                        : "—"}
                    </p>
                    <p className="mt-3 text-base font-semibold text-black">
                      Manager overall:{" "}
                      {overallMgr != null
                        ? ratingLabel(Math.min(5, Math.max(1, Math.round(overallMgr))))
                        : "—"}
                    </p>
                  </div>
                )}

                {isEmployee && (
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                      Manager&apos;s overall rating of you
                    </label>
                    <div
                      className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600 select-none"
                      aria-readonly="true"
                    >
                      {appraisal.status === "reviewed" && overallMgr != null
                        ? ratingLabel(Math.min(5, Math.max(1, Math.round(overallMgr))))
                        : "Not yet available — your manager records this after you submit your appraisal."}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 pt-2">
                <h3 className="mb-2 text-base font-semibold text-black">
                  Comments
                </h3>
                <p className="mb-4 text-sm text-zinc-600">
                  Employees edit their section in draft. Managers add an overall
                  comment when completing the review.
                </p>
                <BigField
                  label="Employee comments"
                  readOnly={!employeeEditable || isManager}
                  readOnlyMuted={isManager}
                  textareaClassName={inputEnterprise}
                  value={
                    employeeEditable && !isManager
                      ? draft!.employeeComments
                      : appraisal.employeeComments
                  }
                  onChange={(v) =>
                    employeeEditable &&
                    !isManager &&
                    draft &&
                    setDraft({ ...draft, employeeComments: v })
                  }
                />
                <div className="mt-6">
                  {isEmployee ? (
                    <>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                        Manager comments (overall)
                      </label>
                      <div
                        className="cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600 select-none whitespace-pre-wrap"
                        aria-readonly="true"
                      >
                        {appraisal.managerComments?.trim()
                          ? appraisal.managerComments
                          : "—"}
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                        Manager comments (overall)
                      </label>
                      {managerCanReview ? (
                        <textarea
                          className={`${inputEnterprise} min-h-[120px] resize-y`}
                          rows={5}
                          value={managerReviewComments}
                          onChange={(e) =>
                            setManagerReviewComments(e.target.value)
                          }
                        />
                      ) : (
                        <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-black whitespace-pre-wrap">
                          {appraisal.managerComments?.trim()
                            ? appraisal.managerComments
                            : "—"}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              {!managerWaiting && (
                <div className="mt-8 border-t border-zinc-200 pt-5">
                  <ReferenceGuideButtons
                    onRatingLegend={() => setRatingLegendOpen(true)}
                    onNineBox={() => setNineBoxModalOpen(true)}
                  />
                </div>
              )}
            </section>
            )}
            </div>
            )}

            {employeeReadOnlyEmployee && activeTab === "overall" && (
              <p className="mt-4 text-sm text-zinc-600">
                This appraisal was submitted. You cannot edit employee comments
                anymore.
              </p>
            )}
          </div>

        </div>
      </div>
      <RatingLegendModal
        open={ratingLegendOpen}
        onClose={() => setRatingLegendOpen(false)}
      />
      <PerformanceNineBoxModal
        open={nineBoxModalOpen}
        onClose={() => setNineBoxModalOpen(false)}
      />
      <CapabilityAppendixModal
        open={capabilityAppendixOpen}
        onClose={() => setCapabilityAppendixOpen(false)}
      />
    </div>
  );
}

function ReferenceGuideButtons({
  onRatingLegend,
  onNineBox,
}: {
  onRatingLegend: () => void;
  onNineBox: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <p className="text-xs text-zinc-500 sm:mr-auto">
        Optional reference (not part of your submitted rating).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRatingLegend}
          className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          Suggested performance ratings (1–5)
        </button>
        <button
          type="button"
          onClick={onNineBox}
          className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          9-point performance grid
        </button>
      </div>
    </div>
  );
}

function BigField({
  label,
  value,
  onChange,
  readOnly,
  readOnlyMuted,
  textareaClassName,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  /** Grey read-only well (e.g. manager viewing employee-owned fields). */
  readOnlyMuted?: boolean;
  textareaClassName?: string;
}) {
  const defaultTa =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-black shadow-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";
  return (
    <div>
      <label
        className={`mb-1.5 block text-xs font-medium ${readOnly && readOnlyMuted ? "text-zinc-500" : "text-zinc-600"}`}
      >
        {label}
      </label>
      {readOnly ? (
        <div
          className={
            readOnlyMuted
              ? "cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-600 select-none whitespace-pre-wrap"
              : "rounded-lg border border-zinc-200/80 bg-white px-3 py-2.5 text-sm text-black"
          }
          aria-readonly="true"
        >
          {value?.trim() ? (
            <p className="whitespace-pre-wrap">{value}</p>
          ) : (
            "—"
          )}
        </div>
      ) : (
        <textarea
          className={textareaClassName ?? defaultTa}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
