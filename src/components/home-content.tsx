"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appraisal, CycleStatus } from "@/lib/types";
import { annualCycleStatus, CYCLE_STATUS_LABELS } from "@/lib/types";
import { appraisalListDisplayName } from "@/lib/entity-theme";
import { DEMO_HR } from "@/lib/mock-users";
import { useRole } from "@/contexts/role-context";
import { useSession } from "@/contexts/session-context";
import { saveAppraisalBootstrap } from "@/lib/appraisal-bootstrap";
import { AppShell } from "@/components/app-shell";
import { AdminSettingsPanel } from "@/components/admin-settings-content";
import { SearchableCombobox } from "@/components/searchable-combobox";
import {
  filterAppraisalsForView,
  navCapabilitiesForSession,
  parseAppraisalView,
  viewSubtitle,
  viewTitle,
} from "@/lib/nav-roles";

function cycleStatusBadge(status: CycleStatus) {
  const map: Record<CycleStatus, string> = {
    not_started: "border border-slate-200 bg-slate-50 text-slate-500",
    kpi_created: "border border-sky-200 bg-sky-50 text-sky-800",
    kpi_approved: "border border-indigo-200 bg-indigo-50 text-indigo-800",
    draft: "border border-gold-300 bg-gold-50 text-gold-700",
    submitted: "border border-navy-200 bg-navy-50 text-navy-800",
    completed: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return map[status];
}

function CycleStatusPill({ status }: { status: CycleStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cycleStatusBadge(status)}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "completed"
            ? "bg-emerald-500"
            : status === "submitted"
              ? "bg-navy-600"
              : status === "draft"
                ? "bg-gold-500"
                : status === "kpi_created"
                  ? "bg-sky-500"
                  : status === "kpi_approved"
                    ? "bg-indigo-500"
                    : "bg-slate-300"
        }`}
        aria-hidden
      />
      {CYCLE_STATUS_LABELS[status]}
    </span>
  );
}

function erpAppraisalCycleLabel(year: number) {
  return `${year} Annual Appraisal`;
}

/** Stable HR-APR-* id from record id (order-independent). */
function erpAppraisalDocId(year: number, recordId: string) {
  let h = 0;
  for (let i = 0; i < recordId.length; i++) {
    h = (Math.imul(31, h) + recordId.charCodeAt(i)) >>> 0;
  }
  const seq = (h % 99_998) + 1;
  return `HR-APR-${year}-${String(seq).padStart(5, "0")}`;
}

type ManagerNotification = {
  id: string;
  appraisalId: string;
  employeeName: string;
  createdAt: string;
};

export function HomeContent() {
  const router = useRouter();
  const { user, mode, managerProfile, hrProfile } = useSession();
  const { setRole } = useRole();
  const searchParams = useSearchParams();
  const notice = searchParams.get("notice");
  const [list, setList] = useState<Appraisal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ManagerNotification[]>(
    []
  );
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const managerId = managerProfile?.id ?? null;
  const caps = useMemo(
    () => navCapabilitiesForSession(mode, user, managerId),
    [mode, user, managerId]
  );
  const appraisalView = useMemo(
    () => parseAppraisalView(searchParams.get("view"), caps),
    [searchParams, caps]
  );
  const [employeeFilterId, setEmployeeFilterId] = useState("");

  useEffect(() => {
    setEmployeeFilterId("");
  }, [appraisalView]);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/appraisals");
    if (!res.ok) throw new Error("Failed to load");
    const data = (await res.json()) as Appraisal[];
    setList(data);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (mode !== "manager" || !managerProfile) {
      setNotifications([]);
      return;
    }
    const res = await fetch(
      `/api/notifications?managerId=${encodeURIComponent(managerProfile.id)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as ManagerNotification[];
    setNotifications(data);
  }, [mode, managerProfile]);

  useEffect(() => {
    if (mode === "employee") setRole("employee");
    if (mode === "manager") setRole("manager");
    if (mode === "hr") setRole("hr");
  }, [mode, setRole]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshList();
        if (cancelled) return;
        setError(null);
      } catch {
        if (!cancelled) setError("Could not load appraisals.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshList]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshNotifications();
      } catch {
        if (!cancelled) setNotifications([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNotifications]);

  async function createAppraisalForOwner(ownerUserId: string) {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/appraisals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(
          typeof body?.error === "string" ? body.error : "Could not create."
        );
        return;
      }
      await refreshList();
      await refreshNotifications();
      const appraisal = body as Appraisal;
      saveAppraisalBootstrap(appraisal);
      router.push(`/appraisal/${appraisal.id}`);
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreateBusy(false);
    }
  }

  const visibleAppraisals = useMemo(() => {
    if (!list) return null;
    const scoped = filterAppraisalsForView(
      list,
      appraisalView,
      mode,
      user,
      managerId
    );
    if (!employeeFilterId) return scoped;
    return scoped.filter((a) => a.ownerUserId === employeeFilterId);
  }, [list, appraisalView, mode, user, managerId, employeeFilterId]);

  const employeeFilterOptions = useMemo(() => {
    if (!list) return [];
    const scoped = filterAppraisalsForView(
      list,
      appraisalView,
      mode,
      user,
      managerId
    );
    const byOwner = new Map<string, string>();
    for (const a of scoped) {
      if (byOwner.has(a.ownerUserId)) continue;
      const name = appraisalListDisplayName(a, mode ?? "employee", user);
      const label = a.position ? `${name} — ${a.position}` : name;
      byOwner.set(a.ownerUserId, label);
    }
    return [...byOwner.entries()]
      .map(([id, label]) => ({
        id,
        label,
        searchText: label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [list, appraisalView, mode, user, managerId]);

  const myOwnerId =
    mode === "employee" && user
      ? user.id
      : mode === "manager" && managerId
        ? managerId
        : mode === "hr"
          ? DEMO_HR.id
          : null;

  const canCreateMyAppraisal = appraisalView === "my" && myOwnerId != null;

  const reviewedAwaitingHr = useMemo(() => {
    if (!list || !caps.canSuperAdmin) return 0;
    return list.filter((a) => a.status === "reviewed").length;
  }, [list, caps.canSuperAdmin]);

  const greetingName =
    mode === "hr" && hrProfile
      ? hrProfile.displayName
      : mode === "manager" && managerProfile
        ? managerProfile.displayName
        : user?.englishName || user?.employeeName || "there";

  const cycleYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <AppShell active="list">
      {/* Hero strip */}
      <div className="aife-hero-gradient text-white">
        <div className="mx-auto max-w-[1500px] px-4 pb-8 pt-7 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-400">
            {erpAppraisalCycleLabel(cycleYear)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back, {greetingName}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-white/70">
            {appraisalView === "my" &&
              "Track your KPIs, follow your mid-year checkpoint, and submit your annual appraisal."}
            {appraisalView === "team" &&
              "Review direct reports — mid-year checkpoints and annual appraisals."}
            {appraisalView === "admin" &&
              "Super Admin view — all appraisals, free open access for demo review."}
            {appraisalView === "settings" &&
              "Configure review windows and other appraisal module settings."}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-8 sm:px-6">
        {appraisalView === "settings" ? (
          caps.canAdminSettings ? (
            <AdminSettingsPanel />
          ) : (
            <p className="text-sm text-slate-600">
              Admin Settings are only available to HR / Super Admin.
            </p>
          )
        ) : (
          <>
        {notice === "submitted" && (
          <div
            className="mb-5 rounded-xl border border-navy-200 bg-navy-50 px-4 py-3 text-sm text-navy-900"
            role="status"
          >
            Appraisal submitted. <strong>Your manager has been notified.</strong>
          </div>
        )}

        {createError && (
          <p className="mb-5 text-sm text-red-600">{createError}</p>
        )}

        {mode === "manager" && notifications.length > 0 && appraisalView === "team" && (
          <section
            className="mb-6 overflow-hidden rounded-2xl border border-gold-300/70 bg-white shadow-sm"
            aria-label="Review notifications"
          >
            <div className="border-b border-gold-100 bg-gold-50/70 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-500 text-[11px] font-bold text-white">
                  {notifications.length}
                </span>
                Pending your review
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/appraisal/${n.appraisalId}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-navy-50/60"
                  >
                    <span className="text-navy-950">
                      <strong>{n.employeeName}</strong> submitted an appraisal
                    </span>
                    <span className="text-xs font-semibold text-navy-600">
                      Open review →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {caps.canSuperAdmin && reviewedAwaitingHr > 0 && (
          <div
            className="mb-6 rounded-xl border border-gold-300/70 bg-gold-50 px-4 py-3 text-sm text-navy-900"
            role="status"
          >
            {reviewedAwaitingHr === 1 ? (
              <>
                <strong>1 appraisal</strong> has a manager review but has not
                been sent to HR yet — the manager must click{" "}
                <strong>Complete Appraisal</strong>.
              </>
            ) : (
              <>
                <strong>{reviewedAwaitingHr} appraisals</strong> have manager
                reviews but have not been sent to HR yet — the manager must
                click <strong>Complete Appraisal</strong> on each one.
              </>
            )}
          </div>
        )}

        <section
          aria-label="Appraisal list"
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-navy-950">
                {viewTitle(appraisalView)}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {viewSubtitle(appraisalView)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(appraisalView === "team" || appraisalView === "admin") &&
                employeeFilterOptions.length > 0 && (
                  <SearchableCombobox
                    id="employee-filter"
                    label="Search employee"
                    options={employeeFilterOptions}
                    value={employeeFilterId}
                    onChange={setEmployeeFilterId}
                    placeholder="Search employee…"
                    allowClear
                    className="w-72 max-w-full"
                  />
                )}
              <button
                type="button"
                onClick={() => {
                  void refreshList();
                  void refreshNotifications();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-navy-200 hover:text-navy-700"
                title="Refresh"
                aria-label="Refresh list"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              {canCreateMyAppraisal && (
                <button
                  type="button"
                  disabled={createBusy}
                  className="rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-navy-900/20 transition hover:from-navy-800 hover:to-navy-600 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => createAppraisalForOwner(myOwnerId!)}
                >
                  {createBusy ? "Creating…" : "+ New Appraisal"}
                </button>
              )}
            </div>
          </div>

          {error && <p className="px-5 py-4 text-sm text-red-600">{error}</p>}
          {!list && !error && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              Loading…
            </p>
          )}

          {list && list.length === 0 && (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-slate-600">
                No appraisals on the server yet.
              </p>
              {canCreateMyAppraisal ? (
                <button
                  type="button"
                  disabled={createBusy}
                  className="mt-4 rounded-lg bg-gradient-to-r from-navy-900 to-navy-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => createAppraisalForOwner(myOwnerId!)}
                >
                  {createBusy ? "Creating…" : "Create first appraisal"}
                </button>
              ) : null}
            </div>
          )}

          {visibleAppraisals &&
            list &&
            list.length > 0 &&
            visibleAppraisals.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-600">
                {appraisalView === "my"
                  ? "No personal appraisal yet. Create one above."
                  : employeeFilterId
                    ? "No appraisals match that employee. Clear the search to see everyone."
                    : appraisalView === "team"
                      ? "No appraisals for your direct reports yet."
                      : "No appraisals in the org-wide list yet."}
              </p>
            )}

          {visibleAppraisals && visibleAppraisals.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3" scope="col">
                      Employee
                    </th>
                    <th className="px-4 py-3" scope="col">
                      Mid-Year Status
                    </th>
                    <th className="px-4 py-3" scope="col">
                      Annual Status
                    </th>
                    <th className="px-4 py-3" scope="col">
                      Cycle
                    </th>
                    <th className="px-4 py-3" scope="col">
                      Reference
                    </th>
                    <th className="w-24 px-5 py-3 text-right" scope="col">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAppraisals.map((a) => (
                    <tr
                      key={a.id}
                      tabIndex={0}
                      className="group cursor-pointer border-b border-slate-50 transition-colors last:border-b-0 hover:bg-navy-50/50 focus-visible:bg-navy-50/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-navy-500"
                      onClick={() => router.push(`/appraisal/${a.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/appraisal/${a.id}`);
                        }
                      }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-800"
                            aria-hidden
                          >
                            {appraisalListDisplayName(a, mode ?? "employee", user)
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy-950">
                              {appraisalListDisplayName(
                                a,
                                mode ?? "employee",
                                user
                              )}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {a.position || "—"}
                              {a.entity ? ` · ${a.entity}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <CycleStatusPill status={a.midYearStatus} />
                      </td>
                      <td className="px-4 py-3.5">
                        <CycleStatusPill
                          status={annualCycleStatus(a.status, a.midYearStatus)}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {erpAppraisalCycleLabel(cycleYear)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                        {erpAppraisalDocId(cycleYear, a.id)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-xs font-semibold text-navy-600 opacity-0 transition group-hover:opacity-100">
                          Open →
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {visibleAppraisals && visibleAppraisals.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
              <span>
                {visibleAppraisals.length} record
                {visibleAppraisals.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1 w-5 rounded-full bg-gold-500" aria-hidden />
                AIFE Performance
              </span>
            </div>
          )}
        </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
