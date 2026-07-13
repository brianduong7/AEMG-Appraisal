"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type {
  Appraisal,
  KpiRow,
  MidYearRating,
} from "@/lib/types";
import {
  MAX_KPIS,
  MIN_KPIS,
  MID_YEAR_RATING_LABELS,
  MID_YEAR_RATING_OPTIONS,
} from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { cloneAppraisal } from "@/lib/clone-appraisal";
import {
  DEMO_COMPANY_NAME,
  DEMO_HR,
  DEMO_SKIP_LEVEL_MANAGER,
  employmentProfileFromUser,
  findMockUser,
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
  sumKpiWeights,
  weightedKpiScore,
  weightedKpiScoreFromManagerDraft,
} from "@/lib/kpi-utils";
import { ratingLabel, RATING_OPTIONS } from "@/lib/ratings";
import { useRole } from "@/contexts/role-context";
import { RatingReadOnly, RatingSelect } from "@/components/rating-select";
import {
  RatingLegendModal,
} from "@/components/rating-legend";
import {
  PerformanceNineBoxModal,
} from "@/components/performance-nine-box-reference";
import {
  readAppraisalBootstrap,
  saveAppraisalBootstrap,
} from "@/lib/appraisal-bootstrap";
import { DEMO_BRANCH_MANAGER_COMMENTS } from "@/lib/branch-manager-comments-demo";
import { formatDueDateDisplay } from "@/lib/format-date";

function emptyKpi(): KpiRow {
  return {
    goalsAndKpis: "",
    weightPercent: 0,
    dueDate: "",
    selfRating: null,
    managerRating: null,
    managerComments: "",
    midYearRating: null,
    midYearComment: "",
  };
}

const APPRAISAL_TABS = [
  ["overview", "Overview"],
  ["capability", "Capability"],
  ["kpi", "KPI"],
  ["overall", "Overall"],
] as const;

/** Shared Review-cycles layout — Mid-Year and Annual use the same 2-col grid. */
const REVIEW_CYCLE_GRID =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start sm:gap-x-4";
const REVIEW_CYCLE_SUBLABEL =
  "mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500";
const REVIEW_CYCLE_SECTION_TITLE =
  "mb-2 text-[10px] font-semibold uppercase tracking-wide";
const REVIEW_CYCLE_VALUE =
  "min-h-7 text-sm leading-snug text-navy-950";

type AppraisalTabId = (typeof APPRAISAL_TABS)[number][0];

function initialDraftForRole(
  appraisal: Appraisal,
  role: "employee" | "manager" | "hr"
): Appraisal | null {
  if (appraisal.status === "draft" && role === "employee") {
    const next = cloneAppraisal(appraisal);
    while (next.kpis.length < MIN_KPIS) {
      next.kpis.push(emptyKpi());
    }
    return next;
  }
  return null;
}

type ManagerKpiLine = { managerRating: number | null };
type ManagerCapLine = { managerRating: number | null };
type MidYearKpiLine = {
  midYearRating: MidYearRating | null;
  midYearComment: string;
};
type MidYearCapLine = {
  midYearRating: number | null;
  midYearComment: string;
};

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
    let cancelled = false;

    if (initialAppraisal) {
      setAppraisal(initialAppraisal);
      setLoadState("ready");
    } else {
      setLoadState("loading");
    }

    (async () => {
      try {
        const res = await fetch(`/api/appraisals/${id}`, { cache: "no-store" });
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

      if (cancelled) return;

      if (initialAppraisal) {
        setAppraisal(initialAppraisal);
        saveAppraisalBootstrap(initialAppraisal);
        setLoadState("ready");
        return;
      }

      const fromSession = readAppraisalBootstrap(id);
      if (fromSession?.id === id) {
        setAppraisal(fromSession);
        setLoadState("ready");
        return;
      }

      setLoadState("notfound");
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
  const { user: sessionUser, mode } = useSession();
  const { role, setRole } = useRole();

  /** HR viewing their own record acts as the employee for that appraisal. */
  const viewingOwnAsHr =
    mode === "hr" && appraisal.ownerUserId === DEMO_HR.id;
  const user = viewingOwnAsHr
    ? (findMockUser(DEMO_HR.id) ?? sessionUser)
    : sessionUser;

  useEffect(() => {
    if (mode === "employee") setRole("employee");
    if (mode === "manager") setRole("manager");
    if (mode === "hr") {
      setRole(viewingOwnAsHr ? "employee" : "hr");
    }
  }, [mode, setRole, viewingOwnAsHr]);

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
    if (role !== "employee") {
      setDraft(null);
      return;
    }
    if (appraisal.status === "draft") {
      const next = cloneAppraisal(appraisal);
      while (next.kpis.length < MIN_KPIS) {
        next.kpis.push(emptyKpi());
      }
      setDraft(next);
      return;
    }
    if (appraisal.status === "submitted") {
      setDraft(cloneAppraisal(appraisal));
      return;
    }
    setDraft(null);
  }, [appraisal, role]);

  const [managerKpiDraft, setManagerKpiDraft] = useState<
    ManagerKpiLine[] | null
  >(null);
  const [managerCapDraft, setManagerCapDraft] = useState<
    ManagerCapLine[] | null
  >(null);
  const [managerReviewComments, setManagerReviewComments] = useState("");
  const [managerOverallOverrideDraft, setManagerOverallOverrideDraft] =
    useState<number | null>(null);
  const [midYearDraft, setMidYearDraft] = useState<MidYearKpiLine[] | null>(
    null
  );
  const [midYearCapDraft, setMidYearCapDraft] = useState<
    MidYearCapLine[] | null
  >(null);
  const [midYearOverallComment, setMidYearOverallComment] = useState("");
  const [midYearBanner, setMidYearBanner] = useState<
    null | "saved" | "submitted"
  >(null);
  const [skipLevelNotice, setSkipLevelNotice] = useState(false);
  const [activeTab, setActiveTab] = useState<AppraisalTabId>("overview");
  const [ratingLegendOpen, setRatingLegendOpen] = useState(false);
  const [nineBoxModalOpen, setNineBoxModalOpen] = useState(false);

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
      setManagerOverallOverrideDraft(appraisal.managerOverallOverride ?? null);
      setMidYearDraft(
        appraisal.kpis.map((k) => ({
          midYearRating: k.midYearRating ?? null,
          midYearComment: k.midYearComment ?? "",
        }))
      );
      setMidYearCapDraft(
        appraisal.capabilities.map((c) => ({
          midYearRating: c.midYearRating ?? null,
          midYearComment: c.midYearComment ?? "",
        }))
      );
      setMidYearOverallComment(appraisal.midYearManagerComments ?? "");
    } else if (
      role === "employee" &&
      appraisal.status === "submitted" &&
      appraisal.midYearStatus !== "completed"
    ) {
      setMidYearDraft(
        appraisal.kpis.map((k) => ({
          midYearRating: k.midYearRating ?? null,
          midYearComment: k.midYearComment ?? "",
        }))
      );
    } else {
      setManagerKpiDraft(null);
      setManagerCapDraft(null);
      setManagerReviewComments("");
      setManagerOverallOverrideDraft(null);
      setMidYearDraft(null);
      setMidYearCapDraft(null);
      setMidYearOverallComment("");
    }
  }, [appraisal, role]);

  const employeeKpiEditable =
    role === "employee" && appraisal.status === "draft" && draft != null;
  const employeeMidYearEditable =
    role === "employee" &&
    appraisal.status === "submitted" &&
    appraisal.midYearStatus !== "completed" &&
    draft != null;
  const employeeAnnualEditable =
    role === "employee" &&
    appraisal.status === "submitted" &&
    appraisal.midYearStatus === "completed" &&
    draft != null;
  const employeeCanEditComments =
    employeeKpiEditable || employeeMidYearEditable || employeeAnnualEditable;
  const src =
    employeeKpiEditable || employeeMidYearEditable || employeeAnnualEditable
      ? draft!
      : appraisal;
  const showEmployeeSelfRating =
    appraisal.status !== "draft" && appraisal.midYearStatus === "completed";
  const showReviewCycles = appraisal.status !== "draft";
  const showAnnualReview = appraisal.midYearStatus === "completed";
  const showKpiRatingsSummary = showEmployeeSelfRating;
  const weightTotal = useMemo(() => sumKpiWeights(src.kpis), [src.kpis]);
  const weightsOk = Math.abs(weightTotal - 100) < 0.01;

  const kpiSelfScore = weightedKpiScore(src.kpis, "self");
  const capSelfAvg = capabilitySelfAverage(src.capabilities);

  const employeeSubmitReady = useMemo(() => {
    if (!draft || !employeeKpiEditable) return false;
    if (draft.kpis.length < MIN_KPIS || draft.kpis.length > MAX_KPIS) {
      return false;
    }
    if (!weightsOk) return false;
    if (!draft.kpis.every((k) => (Number(k.weightPercent) || 0) > 0)) {
      return false;
    }
    return true;
  }, [draft, weightsOk, employeeKpiEditable]);

  const employeeMidYearSubmitReady = useMemo(() => {
    if (!draft || !employeeMidYearEditable) return false;
    return draft.kpis.every((k) => k.midYearRating != null);
  }, [draft, employeeMidYearEditable]);

  const employeeAnnualSubmitReady = useMemo(() => {
    if (!draft || !employeeAnnualEditable) return false;
    if (!draft.kpis.every((k) => k.selfRating != null)) return false;
    if (!draft.capabilities.every((c) => c.selfRating != null)) return false;
    return true;
  }, [draft, employeeAnnualEditable]);

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
        `Add ${MIN_KPIS}–${MAX_KPIS} KPIs, set each weight above 0%, and total exactly 100% before submitting.`
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

  async function completeAppraisalToHr() {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/appraisals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manager_complete" }),
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
      setCompleteAppraisalDemoBanner(true);
      setSkipLevelNotice(true);
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
          managerOverallOverride: managerOverallOverrideDraft,
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

  async function saveEmployeeMidYear(
    action: "employee_midyear_save" | "employee_midyear_submit"
  ) {
    if (!draft) return;
    if (action === "employee_midyear_submit" && !employeeMidYearSubmitReady) {
      setFormError(
        "Select On Track / Not on Track for every KPI before submitting your mid-year review."
      );
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/appraisals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          kpis: draft.kpis.map((k) => ({ midYearRating: k.midYearRating })),
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
      if (action === "employee_midyear_submit") {
        setEmployeeBanner(true);
      }
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEmployeeAnnual(
    action: "employee_annual_save" | "employee_annual_submit"
  ) {
    if (!draft || !user) return;
    if (user.id !== appraisal.ownerUserId) return;
    if (action === "employee_annual_submit" && !employeeAnnualSubmitReady) {
      setFormError(
        "Select a self rating for every KPI and capability before submitting."
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
      if (action === "employee_annual_submit") {
        setEmployeeBanner(true);
      }
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMidYear(
    action: "manager_midyear_save" | "manager_midyear_submit"
  ) {
    if (!midYearDraft) return;
    if (
      action === "manager_midyear_submit" &&
      midYearDraft.some((l) => !l.midYearComment.trim())
    ) {
      setFormError(
        "Add a mid-year comment for every KPI before submitting the mid-year review."
      );
      return;
    }
    if (
      action === "manager_midyear_submit" &&
      appraisal.kpis.some((k) => k.midYearRating == null)
    ) {
      setFormError(
        "The employee must submit their mid-year ratings before you can complete the mid-year review."
      );
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/appraisals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          kpis: midYearDraft.map((l) => ({ midYearComment: l.midYearComment })),
          capabilities: midYearCapDraft?.map((l) => ({
            midYearComment: l.midYearComment,
          })),
          midYearManagerComments: midYearOverallComment,
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
      setMidYearBanner(
        action === "manager_midyear_submit" ? "submitted" : "saved"
      );
    } catch {
      setFormError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const isEmployee = role === "employee";
  const isManager = role === "manager";
  const isHr = role === "hr";
  /** Mid-year: manager comments per KPI after employee mid-year ratings. */
  const managerCanMidYear =
    isManager &&
    (appraisal.status === "submitted" || appraisal.status === "reviewed") &&
    appraisal.midYearStatus !== "completed" &&
    midYearDraft != null;
  const employeeReadOnlyEmployee =
    isEmployee &&
    (appraisal.status === "reviewed" || appraisal.status === "completed");
  const managerWaiting = isManager && appraisal.status === "draft";
  const employeeAnnualRatingsComplete =
    appraisal.kpis.every((k) => k.selfRating != null) &&
    appraisal.capabilities.every((c) => c.selfRating != null);
  const managerCanAnnualReview =
    isManager &&
    (appraisal.status === "submitted" || appraisal.status === "reviewed") &&
    appraisal.midYearStatus === "completed" &&
    employeeAnnualRatingsComplete &&
    managerKpiDraft != null &&
    managerCapDraft != null;
  const managerCanReview = managerCanAnnualReview;

  /** Reference guides: HR / Super Admin always; others when completed. */
  const showAppraisalReferenceTools =
    isHr || appraisal.status === "completed";

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

  const managerOverallOverrideActive = managerCanReview
    ? managerOverallOverrideDraft
    : appraisal.managerOverallOverride;

  const computedManagerOverallLabel =
    overallMgr != null
      ? ratingLabel(Math.min(5, Math.max(1, Math.round(overallMgr))))
      : null;

  const finalManagerOverallLabel =
    managerOverallOverrideActive != null
      ? ratingLabel(managerOverallOverrideActive)
      : computedManagerOverallLabel;

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

  /* HR / Super Admin: free open access in demo (cycle lock windows deferred). */

  return (
    <AppShell active="detail">
      <div className="mx-auto w-full max-w-[min(100%,96rem)] flex-1 px-6 py-8">
      <Link
        href={
          mode === "hr"
            ? "/?view=admin"
            : mode === "manager"
              ? "/?view=team"
              : "/?view=my"
        }
        className="mb-6 inline-block text-sm font-medium text-navy-600 hover:text-navy-800"
      >
        ← Back to appraisals
      </Link>

      {employeeBanner && (
        <div
          className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          role="status"
        >
          KPIs submitted. Your manager
          {appraisal.reviewingManagerId ? (
            <>
              {" "}
              (<strong>Mark Stevenson</strong>)
            </>
          ) : (
            <>
              {" "}
              (<strong>{appraisal.managerName}</strong>)
            </>
          )}{" "}
          and <strong>HR</strong> have been notified. Mid-year and annual
          ratings unlock next.
        </div>
      )}

      {managerBanner === "saved" && (
        <div
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Manager review saved. Status is now <strong>reviewed</strong>.
          <p className="mt-2">
            HR will not see this yet — click <strong>Complete Appraisal</strong>{" "}
            above to send it to HR.
          </p>
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
          <strong>Sent to HR.</strong> This appraisal is locked — it cannot be
          edited by the employee or manager anymore.
        </div>
      )}
      {skipLevelNotice && (
        <div
          className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
          role="status"
        >
          <strong>Demo notifications sent</strong> to the direct manager and one
          level above: <strong>{DEMO_SKIP_LEVEL_MANAGER.displayName}</strong> (
          {DEMO_SKIP_LEVEL_MANAGER.role}). Hierarchy pending Sam&apos;s
          confirmation.
        </div>
      )}

      {midYearBanner === "saved" && (
        <div
          className="mb-6 rounded-lg border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-navy-900"
          role="status"
        >
          Mid-year checkpoint saved as <strong>draft</strong>. Submit it when
          your one-on-one is done.
        </div>
      )}
      {midYearBanner === "submitted" && (
        <div
          className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          role="status"
        >
          Mid-year review <strong>completed</strong>. Ratings and comments are
          visible on the Annual review.
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">
              Appraisal
            </h1>
            <span className="text-xs text-slate-500">
              {isEmployee ? "Employee" : isHr ? "HR" : "Manager"} ·{" "}
              {identity.englishName || identity.employeeName}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Overview fields come from your F3 / HR account setup and are read-only
            here.
          </p>
          {mode === "employee" && employeeReadOnlyEmployee && (
            <p className="mt-2 text-sm text-zinc-600">
              <strong>View only</strong> — your manager has finalized this
              appraisal.
            </p>
          )}
          {mode === "employee" &&
            appraisal.status === "submitted" &&
            appraisal.midYearStatus !== "completed" && (
              <p className="mt-2 text-sm text-zinc-600">
                <strong>Mid-year review</strong> — record your On Track /
                Not on Track rating for each KPI. Your manager will add
                comments after your one-on-one.
              </p>
            )}
          {mode === "employee" && employeeAnnualEditable && (
            <p className="mt-2 text-sm text-zinc-600">
              <strong>Annual self-rating</strong> — rate each KPI and
              capability, then submit for your manager&apos;s review.
            </p>
          )}
          {mode === "manager" && appraisal.status === "completed" && (
            <p className="mt-2 text-sm text-zinc-600">
              <strong>View only</strong> — this appraisal was sent to HR and
              cannot be edited.
            </p>
          )}
          {mode === "hr" && (
            <p className="mt-2 text-sm text-zinc-600">
              <strong>Super Admin / HR view</strong> — free open access in this
              demo (cycle lock windows deferred).
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {employeeKpiEditable && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy-950 shadow-sm transition hover:border-navy-300 disabled:opacity-50"
                onClick={() => saveEmployee("employee_save")}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy || !employeeSubmitReady}
                title={
                  !employeeSubmitReady
                    ? `Need ${MIN_KPIS}–${MAX_KPIS} KPIs with weights totalling 100%`
                    : undefined
                }
                className="rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:from-navy-800 hover:to-navy-600 disabled:opacity-50"
                onClick={() => saveEmployee("employee_submit")}
              >
                Submit KPIs
              </button>
            </>
          )}
          {employeeMidYearEditable && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy-950 shadow-sm transition hover:border-navy-300 disabled:opacity-50"
                onClick={() => saveEmployeeMidYear("employee_midyear_save")}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy || !employeeMidYearSubmitReady}
                title={
                  !employeeMidYearSubmitReady
                    ? "Select a mid-year rating for every KPI"
                    : undefined
                }
                className="rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:from-navy-800 hover:to-navy-600 disabled:opacity-50"
                onClick={() => saveEmployeeMidYear("employee_midyear_submit")}
              >
                Submit mid-year review
              </button>
            </>
          )}
          {employeeAnnualEditable && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy-950 shadow-sm transition hover:border-navy-300 disabled:opacity-50"
                onClick={() => saveEmployeeAnnual("employee_annual_save")}
              >
                Save
              </button>
              <button
                type="button"
                disabled={busy || !employeeAnnualSubmitReady}
                title={
                  !employeeAnnualSubmitReady
                    ? "Complete all KPI and capability self-ratings to submit"
                    : undefined
                }
                className="rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:from-navy-800 hover:to-navy-600 disabled:opacity-50"
                onClick={() => saveEmployeeAnnual("employee_annual_submit")}
              >
                Submit for manager review
              </button>
            </>
          )}
          {managerCanMidYear && (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy-950 shadow-sm transition hover:border-navy-300 disabled:opacity-50"
                onClick={() => void saveMidYear("manager_midyear_save")}
              >
                Save mid-year
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:from-navy-800 hover:to-navy-600 disabled:opacity-50"
                onClick={() => void saveMidYear("manager_midyear_submit")}
              >
                Submit mid-year review
              </button>
            </>
          )}
          {managerCanReview && (
            <>
              {appraisal.status === "reviewed" && (
                <button
                  type="button"
                  disabled={busy}
                  className="rounded-lg bg-gradient-to-r from-gold-600 to-gold-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-gold-600/25 transition hover:from-gold-700 hover:to-gold-600 disabled:opacity-50"
                  onClick={() => void completeAppraisalToHr()}
                >
                  Complete Appraisal
                </button>
              )}
              <button
                type="button"
                disabled={busy || !managerSubmitReady}
                title={
                  !managerSubmitReady
                    ? "Select a manager rating for every KPI and capability"
                    : undefined
                }
                className={
                  appraisal.status === "reviewed"
                    ? "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-navy-950 shadow-sm transition hover:border-navy-300 disabled:opacity-50"
                    : "rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:from-navy-800 hover:to-navy-600 disabled:opacity-50"
                }
                onClick={() => submitManagerReview()}
              >
                {appraisal.status === "reviewed"
                  ? "Update manager review"
                  : "Submit manager review"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
          {APPRAISAL_TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === id
                  ? "border-gold-500 text-navy-900"
                  : "border-transparent text-slate-500 hover:text-navy-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <TabStepNav activeTab={activeTab} onTabChange={setActiveTab} />
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
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-black">
                  Capability and skill development
                </h2>
              </div>
              <p className="mb-4 text-sm text-zinc-600">
                Descriptions are prefilled for your M level.
              </p>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                      <th className="w-12 px-2 py-2.5" scope="col">
                        No.
                      </th>
                      <th className="min-w-36 px-2 py-2.5" scope="col">
                        Capability
                      </th>
                      <th className="min-w-[16rem] px-2 py-2.5" scope="col">
                        Description
                      </th>
                      {showReviewCycles && (
                        <th className="min-w-[22rem] px-2 py-2.5" scope="col">
                          Review cycles
                          <span className="mt-0.5 block font-normal normal-case tracking-normal text-zinc-500">
                            Mid-Year comments and Annual ratings stacked
                          </span>
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
                        {showReviewCycles && (
                          <td className="px-2 py-2">
                            <div className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200">
                              <div className="bg-gold-50/50 px-2.5 py-2.5">
                                <p
                                  className={`${REVIEW_CYCLE_SECTION_TITLE} text-gold-700`}
                                >
                                  Mid-Year
                                </p>
                                <p className={REVIEW_CYCLE_SUBLABEL}>
                                  Manager Comments
                                </p>
                                <div className={REVIEW_CYCLE_VALUE}>
                                  {managerCanMidYear && midYearCapDraft ? (
                                    <textarea
                                      rows={2}
                                      className={`${inputEnterprise} min-h-12 resize-y text-sm`}
                                      placeholder="Mid-year comment…"
                                      value={
                                        midYearCapDraft[i]?.midYearComment ?? ""
                                      }
                                      onChange={(e) => {
                                        const next = [...midYearCapDraft];
                                        next[i] = {
                                          ...next[i],
                                          midYearComment: e.target.value,
                                        };
                                        setMidYearCapDraft(next);
                                      }}
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap text-sm text-zinc-700">
                                      {cap.midYearComment?.trim()
                                        ? cap.midYearComment
                                        : "—"}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {showAnnualReview && (
                              <div className="bg-navy-50/40 px-2.5 py-2.5">
                                <p
                                  className={`${REVIEW_CYCLE_SECTION_TITLE} text-navy-800`}
                                >
                                  Annual
                                  {(employeeAnnualEditable || managerCanReview) && (
                                    <span className="text-red-600"> *</span>
                                  )}
                                </p>
                                <div className={REVIEW_CYCLE_GRID}>
                                  <div>
                                    <p className={REVIEW_CYCLE_SUBLABEL}>
                                      Employee
                                    </p>
                                    <div className={REVIEW_CYCLE_VALUE}>
                                      {employeeAnnualEditable ? (
                                        <RatingSelect
                                          className="[&_span]:hidden"
                                          value={cap.selfRating}
                                          onChange={(n) => {
                                            if (!draft) return;
                                            const caps = [...draft.capabilities];
                                            caps[i] = {
                                              ...caps[i],
                                              selfRating: n,
                                            };
                                            setDraft({
                                              ...draft,
                                              capabilities: caps,
                                            });
                                          }}
                                        />
                                      ) : cap.selfRating != null ? (
                                        <RatingReadOnly value={cap.selfRating} />
                                      ) : (
                                        <span className="text-zinc-400">—</span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className={REVIEW_CYCLE_SUBLABEL}>
                                      Manager
                                    </p>
                                    <div className={REVIEW_CYCLE_VALUE}>
                                      {managerCanReview && managerCapDraft ? (
                                        <RatingSelect
                                          className="[&_span]:hidden"
                                          value={
                                            managerCapDraft[i].managerRating
                                          }
                                          onChange={(n) => {
                                            const next = [...managerCapDraft];
                                            next[i] = {
                                              ...next[i],
                                              managerRating: n,
                                            };
                                            setManagerCapDraft(next);
                                          }}
                                        />
                                      ) : cap.managerRating != null ? (
                                        <RatingReadOnly
                                          value={cap.managerRating}
                                        />
                                      ) : (
                                        <span className="text-zinc-400">—</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showEmployeeSelfRating && (
              <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                <p>
                  <span className="font-medium">Capability average</span> — Self:{" "}
                  {capSelfAvg != null
                    ? `${capSelfAvg.toFixed(2)} (${ratingLabel(Math.min(5, Math.max(1, Math.round(capSelfAvg))))})`
                    : "—"}
                </p>
                {isManager && (
                  <p className="mt-1">
                    Manager:{" "}
                    {capMgrAvg != null
                      ? `${capMgrAvg.toFixed(2)} (${ratingLabel(Math.min(5, Math.max(1, Math.round(capMgrAvg))))})`
                      : "—"}
                  </p>
                )}
              </div>
              )}
              </>
            )}
                  </section>
                </div>
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
              <div className="mb-2">
                <h2 className="text-lg font-semibold text-black">
                  Key Performance Indicators
                </h2>
              </div>
              <p className="mb-4 text-sm text-zinc-600">
                {employeeKpiEditable
                  ? `Add ${MIN_KPIS}–${MAX_KPIS} KPIs with weight (%) and due date. Submit when you have at least ${MIN_KPIS} KPIs and weights total 100% — your manager and HR are notified. Ratings come later at mid-year and annual review.`
                  : `${MIN_KPIS}–${MAX_KPIS} KPIs. Mid-year and annual ratings appear in Review cycles after KPIs are submitted. The KPI score is weighted: each row contributes weight% × rating, summed and divided by total weight% (1–5 scale).`}
              </p>
              <div
                className={`mb-3 text-sm ${weightsOk ? "text-emerald-700" : "text-amber-800"}`}
              >
                Total weight: <strong>{weightTotal}%</strong>
                {!weightsOk && employeeKpiEditable && (
                  <span> — adjust to 100% before submit.</span>
                )}
                {employeeKpiEditable && draft!.kpis.length < MIN_KPIS && (
                  <span className="ml-1">
                    Add at least {MIN_KPIS} KPIs before submit (
                    {draft!.kpis.length}/{MIN_KPIS}).
                  </span>
                )}
                {employeeKpiEditable &&
                  draft!.kpis.some((k) => (Number(k.weightPercent) || 0) <= 0) && (
                    <span className="ml-1">
                      Each KPI needs a weight greater than 0%.
                    </span>
                  )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
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
                      <th className="min-w-52 px-2 py-2.5" scope="col">
                        KPI <span className="text-red-600">*</span>
                      </th>
                      <th className="w-24 px-2 py-2.5" scope="col">
                        Weight (%) <span className="text-red-600">*</span>
                      </th>
                      <th className="w-32 px-2 py-2.5" scope="col">
                        Due date
                      </th>
                      {showReviewCycles && (
                        <th className="min-w-[22rem] px-2 py-2.5" scope="col">
                          Review cycles
                          <span className="mt-0.5 block font-normal normal-case tracking-normal text-zinc-500">
                            Mid-Year and Annual stacked per KPI
                          </span>
                        </th>
                      )}
                      {employeeKpiEditable && (
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
                          {employeeKpiEditable ? (
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
                          {employeeKpiEditable ? (
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
                          {employeeKpiEditable ? (
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
                              {formatDueDateDisplay(kpi.dueDate)}
                            </span>
                          )}
                        </td>
                        {showReviewCycles && (
                          <td className="px-2 py-2">
                            <div className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200">
                              <div className="bg-gold-50/50 px-2.5 py-2.5">
                                <p
                                  className={`${REVIEW_CYCLE_SECTION_TITLE} text-gold-700`}
                                >
                                  Mid-Year
                                  {(employeeMidYearEditable ||
                                    managerCanMidYear) && (
                                    <span className="text-red-600"> *</span>
                                  )}
                                </p>
                                <div className={REVIEW_CYCLE_GRID}>
                                  <div>
                                    <p className={REVIEW_CYCLE_SUBLABEL}>
                                      Employee
                                    </p>
                                    <div className={REVIEW_CYCLE_VALUE}>
                                      {employeeMidYearEditable ? (
                                        <select
                                          aria-label={`Mid-year rating for KPI ${i + 1}`}
                                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                                          value={kpi.midYearRating ?? ""}
                                          onChange={(e) => {
                                            if (!draft) return;
                                            const kpis = [...draft.kpis];
                                            kpis[i] = {
                                              ...kpis[i],
                                              midYearRating: (e.target
                                                .value ||
                                                null) as MidYearRating | null,
                                            };
                                            setDraft({ ...draft, kpis });
                                          }}
                                        >
                                          <option value="">Select</option>
                                          {MID_YEAR_RATING_OPTIONS.map((r) => (
                                            <option key={r} value={r}>
                                              {MID_YEAR_RATING_LABELS[r]}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <MidYearRatingBadge
                                          rating={kpi.midYearRating}
                                        />
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className={REVIEW_CYCLE_SUBLABEL}>
                                      Manager Comments
                                    </p>
                                    <div className={REVIEW_CYCLE_VALUE}>
                                      {managerCanMidYear && midYearDraft ? (
                                        <textarea
                                          rows={2}
                                          className={`${inputEnterprise} min-h-12 resize-y text-sm`}
                                          placeholder="Mid-year comment…"
                                          value={
                                            midYearDraft[i]?.midYearComment ??
                                            ""
                                          }
                                          onChange={(e) => {
                                            const next = [...midYearDraft];
                                            next[i] = {
                                              ...next[i],
                                              midYearComment: e.target.value,
                                            };
                                            setMidYearDraft(next);
                                          }}
                                        />
                                      ) : (
                                        <p className="whitespace-pre-wrap text-sm text-zinc-700">
                                          {kpi.midYearComment?.trim()
                                            ? kpi.midYearComment
                                            : "—"}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {showAnnualReview && (
                              <div className="bg-navy-50/40 px-2.5 py-2.5">
                                <p
                                  className={`${REVIEW_CYCLE_SECTION_TITLE} text-navy-800`}
                                >
                                  Annual
                                  {(employeeAnnualEditable || managerCanReview) && (
                                    <span className="text-red-600"> *</span>
                                  )}
                                </p>
                                <div className={REVIEW_CYCLE_GRID}>
                                  <div>
                                    <p className={REVIEW_CYCLE_SUBLABEL}>
                                      Employee
                                    </p>
                                    <div className={REVIEW_CYCLE_VALUE}>
                                      {employeeAnnualEditable ? (
                                        <RatingSelect
                                          className="[&_span]:hidden"
                                          value={kpi.selfRating}
                                          onChange={(n) => {
                                            if (!draft) return;
                                            const kpis = [...draft.kpis];
                                            kpis[i] = {
                                              ...kpis[i],
                                              selfRating: n,
                                            };
                                            setDraft({ ...draft, kpis });
                                          }}
                                        />
                                      ) : kpi.selfRating != null ? (
                                        <RatingReadOnly value={kpi.selfRating} />
                                      ) : (
                                        <span className="text-zinc-400">—</span>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <p className={REVIEW_CYCLE_SUBLABEL}>
                                      Manager
                                    </p>
                                    <div className={REVIEW_CYCLE_VALUE}>
                                      {managerCanReview && managerKpiDraft ? (
                                        <RatingSelect
                                          className="[&_span]:hidden"
                                          value={
                                            managerKpiDraft[i].managerRating
                                          }
                                          onChange={(n) => {
                                            const next = [...managerKpiDraft];
                                            next[i] = {
                                              ...next[i],
                                              managerRating: n,
                                            };
                                            setManagerKpiDraft(next);
                                          }}
                                        />
                                      ) : kpi.managerRating != null ? (
                                        <RatingReadOnly
                                          value={kpi.managerRating}
                                        />
                                      ) : (
                                        <span className="text-zinc-400">—</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              )}
                            </div>
                          </td>
                        )}
                        {employeeKpiEditable && (
                          <td className="px-2 py-2 text-center">
                            {draft!.kpis.length > MIN_KPIS ? (
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
              {employeeKpiEditable && draft!.kpis.length < MAX_KPIS && (
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
              {showKpiRatingsSummary && (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-navy-950">
                  KPI ratings summary
                </h3>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                    <dt className="text-xs font-medium text-slate-500">
                      Employee Self Rating
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-navy-950">
                      {kpiSelfScore != null
                        ? ratingLabel(
                            Math.min(5, Math.max(1, Math.round(kpiSelfScore)))
                          )
                        : "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                    <dt className="text-xs font-medium text-slate-500">
                      Manager Rating
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-navy-950">
                      {(isManager || appraisal.status !== "draft") &&
                      kpiMgrScore != null
                        ? ratingLabel(
                            Math.min(5, Math.max(1, Math.round(kpiMgrScore)))
                          )
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
              )}

              {(isManager || isHr) && appraisal.status !== "draft" && (
                <FeedbackSection />
              )}
              </>
              )}
            </section>
                </div>
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
                    value={identity.englishName || identity.employeeName}
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
                    label="Level Grade"
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
                  Overall review summary
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

                {(isManager || isHr) && !managerWaiting && (
                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <p className="text-sm text-zinc-600">
                      {isHr
                        ? "Figures below reflect the manager’s final ratings from the KPI and Capability tabs."
                        : "Manager view: figures below use your ratings from the KPI and Capability tabs (including while you complete the review)."}
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
                      {computedManagerOverallLabel ?? "—"}
                    </p>
                    {managerCanReview ? (
                      <div className="mt-3">
                        <label
                          htmlFor="overall-final-rating-override"
                          className="mb-1.5 block text-sm font-bold text-red-600"
                        >
                          Final Rating
                        </label>
                        <select
                          id="overall-final-rating-override"
                          className="w-full max-w-md rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
                          value={
                            managerOverallOverrideDraft == null
                              ? ""
                              : String(managerOverallOverrideDraft)
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setManagerOverallOverrideDraft(
                              v === "" ? null : Number(v)
                            );
                          }}
                        >
                          <option value="">
                            {computedManagerOverallLabel
                              ? `Use calculated (${computedManagerOverallLabel})`
                              : "Use calculated rating"}
                          </option>
                          {RATING_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {ratingLabel(n)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs text-slate-500">
                          Adjust if the final rating should differ from the
                          calculated manager overall. Saved when you submit the
                          manager review.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-base font-bold text-red-600">
                        Final Rating: {finalManagerOverallLabel ?? "—"}
                      </p>
                    )}
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
                      {(appraisal.status === "reviewed" ||
                        appraisal.status === "completed") &&
                      finalManagerOverallLabel
                        ? finalManagerOverallLabel
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
                  readOnly={!employeeCanEditComments || isManager}
                  readOnlyMuted={isManager}
                  textareaClassName={inputEnterprise}
                  value={
                    employeeCanEditComments && !isManager
                      ? draft!.employeeComments
                      : appraisal.employeeComments
                  }
                  onChange={(v) =>
                    employeeCanEditComments &&
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
              {showAppraisalReferenceTools && !managerWaiting && (
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
    </AppShell>
  );
}

/**
 * Feedback from authorised reviewers (Branch Manager / Team Leader / Manager).
 * Visible to the direct manager and HR only — never to the employee.
 */
function FeedbackSection() {
  const [open, setOpen] = useState(false);
  const count = DEMO_BRANCH_MANAGER_COMMENTS.length;
  const preview = DEMO_BRANCH_MANAGER_COMMENTS[0];

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-navy-50/40"
      >
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-navy-950">
            Feedback
            <span className="rounded-full border border-navy-200 bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-800">
              Visible to direct manager &amp; HR only
            </span>
          </p>
          {!open && preview ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {count} note{count === 1 ? "" : "s"} — {preview.branch}:{" "}
              {preview.comment}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              {count} note{count === 1 ? "" : "s"} from authorised reviewers
              (demo data)
            </p>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="space-y-3 border-t border-slate-100 px-4 py-4">
          {DEMO_BRANCH_MANAGER_COMMENTS.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3.5 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-navy-950">
                  {item.branch}
                </p>
                <time
                  className="text-xs text-slate-500"
                  dateTime={item.recordedAt}
                >
                  {item.recordedAt}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {item.managerName} · {item.role}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-navy-950/90">
                {item.comment}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MidYearRatingBadge({ rating }: { rating: MidYearRating | null }) {
  if (rating == null) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  const tone: Record<MidYearRating, string> = {
    on_track: "text-emerald-800",
    not_on_track: "text-red-700",
    early_access: "text-navy-800",
  };
  return (
    <span className={`text-sm font-medium ${tone[rating]}`}>
      {MID_YEAR_RATING_LABELS[rating]}
    </span>
  );
}

function TabStepNav({
  activeTab,
  onTabChange,
}: {
  activeTab: AppraisalTabId;
  onTabChange: (tab: AppraisalTabId) => void;
}) {
  const index = APPRAISAL_TABS.findIndex(([id]) => id === activeTab);
  const prev = index > 0 ? APPRAISAL_TABS[index - 1] : null;
  const next =
    index >= 0 && index < APPRAISAL_TABS.length - 1
      ? APPRAISAL_TABS[index + 1]
      : null;

  if (!prev && !next) return null;

  return (
    <nav
      className="mb-0.5 flex shrink-0 items-center gap-2 pb-2"
      aria-label="Tab navigation"
    >
      {prev ? (
        <button
          type="button"
          onClick={() => onTabChange(prev[0])}
          title={`Go to ${prev[1]}`}
          aria-label={`Go to ${prev[1]}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-medium text-navy-950 shadow-sm transition hover:border-navy-300"
        >
          ←
        </button>
      ) : null}
      {next ? (
        <button
          type="button"
          onClick={() => onTabChange(next[0])}
          title={`Go to ${next[1]}`}
          aria-label={`Go to ${next[1]}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 text-sm font-medium text-white shadow-sm transition hover:from-navy-800 hover:to-navy-600"
        >
          →
        </button>
      ) : null}
    </nav>
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
