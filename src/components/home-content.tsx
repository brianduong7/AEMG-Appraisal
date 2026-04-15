"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Appraisal } from "@/lib/types";
import { appraisalListDisplayName } from "@/lib/entity-theme";
import { MOCK_USERS } from "@/lib/mock-users";
import { useRole } from "@/contexts/role-context";
import { useSession } from "@/contexts/session-context";
import { saveAppraisalBootstrap } from "@/lib/appraisal-bootstrap";
import { HeaderNotificationsButton } from "@/components/header-notifications-button";

function statusBadge(status: Appraisal["status"]) {
  /* ERPNext-style list tags: Draft = red, Submitted = blue, Reviewed = green */
  const map = {
    draft: "border border-red-200 bg-red-50 text-red-700",
    submitted: "border border-sky-200 bg-sky-50 text-sky-800",
    reviewed: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    completed:
      "border border-violet-200 bg-violet-50 text-violet-900",
  };
  return map[status];
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

function deskRelativeTimeLabel(recordId: string) {
  const h = recordId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hours = h % 72;
  if (hours < 48) return `${Math.max(1, hours % 24) || 1}h`;
  return `${Math.floor(hours / 24)}d`;
}

type ManagerNotification = {
  id: string;
  appraisalId: string;
  employeeName: string;
  createdAt: string;
};

export function HomeContent() {
  const router = useRouter();
  const { user, logout, mode, managerProfile, hrProfile } = useSession();
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
  const [managerCreateOwnerId, setManagerCreateOwnerId] = useState(
    MOCK_USERS[0]?.id ?? "emma"
  );

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
    if (mode === "employee" && user) {
      return list.filter(
        (a) => !a.ownerUserId || a.ownerUserId === user.id
      );
    }
    if (mode === "hr") {
      return list.filter((a) => a.status === "completed");
    }
    return list;
  }, [list, mode, user]);

  const sessionLabel =
    mode === "hr" && hrProfile
      ? `${hrProfile.displayName} (HR)`
      : mode === "manager" && managerProfile
        ? `${managerProfile.displayName} (manager)`
        : user?.employeeName ?? "Employee";

  const chromeInitial =
    (mode === "employee" && user?.employeeName?.[0]?.toUpperCase()) ||
    (mode === "manager" && managerProfile?.displayName?.[0]?.toUpperCase()) ||
    (mode === "hr" && hrProfile?.displayName?.[0]?.toUpperCase()) ||
    "A";

  const cycleYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-black">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600"
              aria-hidden
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <nav className="text-xs text-zinc-500" aria-label="Breadcrumb">
              <span className="font-medium text-zinc-800">Performance</span>
              <span className="mx-1 text-zinc-300">&gt;</span>
              <span className="text-zinc-500">Appraisal</span>
            </nav>
          </div>
          <p className="hidden min-w-0 flex-1 text-center text-xs text-zinc-500 md:block">
            Signed in as{" "}
            <span className="font-medium text-zinc-800">{sessionLabel}</span>
            <span className="mx-1.5 text-zinc-300">·</span>
            <button
              type="button"
              onClick={() => logout()}
              className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-black"
            >
              Sign out
            </button>
          </p>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-xl sm:flex-none">
            <input
              type="search"
              readOnly
              placeholder="Search or type a command (⌘ + G)"
              className="hidden w-full min-w-0 max-w-md rounded border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 lg:block"
              aria-hidden
            />
            <button
              type="button"
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded border border-transparent text-zinc-500 hover:bg-zinc-100 sm:flex"
              title="Help"
              aria-label="Help"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path
                  strokeLinecap="round"
                  d="M9.5 9.5a2.5 2.5 0 0 1 4.2-1.7c.9.8 1.3 1.8 1.3 2.7 0 2-2 2.5-2.5 3.5"
                />
                <path strokeLinecap="round" d="M12 17h.01" />
              </svg>
            </button>
            <HeaderNotificationsButton />
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white"
              aria-hidden
            >
              {chromeInitial}
            </div>
          </div>
        </div>
        <p className="border-t border-zinc-100 px-4 py-2 text-center text-xs text-zinc-500 md:hidden">
          Signed in as{" "}
          <span className="font-medium text-zinc-800">{sessionLabel}</span>
          <span className="mx-1.5 text-zinc-300">·</span>
          <button
            type="button"
            onClick={() => logout()}
            className="font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-black"
          >
            Sign out
          </button>
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0 bg-white px-4 py-4 sm:px-6 lg:gap-6">
        <aside
          className="hidden w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-white pr-4 lg:flex"
          aria-label="Filters"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Filter by
          </p>
          <div className="mt-3 space-y-3.5 text-sm">
            <div>
              <label
                htmlFor="filter-assigned"
                className="mb-1 block text-xs font-medium text-zinc-600"
              >
                Assigned To
              </label>
              <select
                id="filter-assigned"
                defaultValue="all"
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 shadow-sm"
              >
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="filter-created"
                className="mb-1 block text-xs font-medium text-zinc-600"
              >
                Created By
              </label>
              <select
                id="filter-created"
                defaultValue="all"
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 shadow-sm"
              >
                <option value="all">All</option>
              </select>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-black"
            >
              Edit Filters
            </button>
            <div>
              <label
                htmlFor="filter-tags"
                className="mb-1 block text-xs font-medium text-zinc-600"
              >
                Tags
              </label>
              <select
                id="filter-tags"
                defaultValue=""
                className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-500 shadow-sm"
              >
                <option value="">—</option>
              </select>
              <button
                type="button"
                className="mt-1.5 text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-black"
              >
                Show Tags
              </button>
            </div>
            <button
              type="button"
              className="text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-black"
            >
              Save filter
            </button>
          </div>
          <div className="mt-5 border-t border-zinc-200 pt-4">
            <label
              htmlFor="filter-name"
              className="text-xs font-medium text-zinc-600"
            >
              Filter Name
            </label>
            <input
              id="filter-name"
              type="text"
              readOnly
              placeholder=""
              className="mt-1.5 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-500"
              aria-hidden
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1 bg-white">
          <div className="rounded-lg border border-zinc-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  title="Menu"
                  aria-label="Open sidebar menu"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                <h1 className="text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl">
                  Appraisal
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  List View
                  <svg
                    className="h-3.5 w-3.5 text-zinc-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void refreshList();
                    void refreshNotifications();
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  title="Refresh"
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
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  title="Menu"
                  aria-label="More actions"
                >
                  <svg
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle cx="12" cy="5" r="1.75" />
                    <circle cx="12" cy="12" r="1.75" />
                    <circle cx="12" cy="19" r="1.75" />
                  </svg>
                </button>
                {mode === "employee" && user && (
                  <button
                    type="button"
                    disabled={createBusy}
                    className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => createAppraisalForOwner(user.id)}
                  >
                    {createBusy ? "Creating…" : "+ Add Appraisal"}
                  </button>
                )}
                {mode === "manager" && (
                  <button
                    type="button"
                    disabled={createBusy}
                    className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => createAppraisalForOwner(managerCreateOwnerId)}
                  >
                    {createBusy ? "Creating…" : "+ Add Appraisal"}
                  </button>
                )}
              </div>
            </div>

            <div className="px-4 pb-4 pt-1 sm:px-5">
              <p className="mb-3 text-xs leading-relaxed text-zinc-600">
                {mode === "employee" && (
                  <>
                    Create a performance plan, edit drafts, and submit for
                    manager review. Demo: one appraisal per employee — latest
                    wins.
                  </>
                )}
                {mode === "manager" && (
                  <>
                    Create drafts for any demo employee, review submissions,
                    and use notifications for plans waiting on you.
                  </>
                )}
                {mode === "hr" && (
                  <>
                    Appraisals appear here after a manager finishes the review
                    and clicks <strong>Complete Appraisal</strong> (sent to HR).
                    Records are read-only.
                  </>
                )}
              </p>

              {mode === "manager" && (
                <div className="mb-4 max-w-md">
                  <label
                    htmlFor="create-for"
                    className="mb-1 block text-xs font-medium text-zinc-600"
                  >
                    New appraisal for employee
                  </label>
                  <select
                    id="create-for"
                    className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm text-black shadow-sm"
                    value={managerCreateOwnerId}
                    onChange={(e) => setManagerCreateOwnerId(e.target.value)}
                  >
                    {MOCK_USERS.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.employeeName} — {u.position}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {createError && (
                <p className="mb-4 text-sm text-red-600">{createError}</p>
              )}

              {notice === "submitted" && (
                <div
                  className="mb-4 rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
                  role="status"
                >
                  Appraisal submitted.{" "}
                  <strong>Manager has been notified.</strong>
                </div>
              )}

              {mode === "manager" && notifications.length > 0 && (
                <section
                  className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-4"
                  aria-label="Review notifications"
                >
                  <h2 className="text-sm font-semibold text-amber-950">
                    Pending your review
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        <Link
                          href={`/appraisal/${n.appraisalId}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200/80 bg-white px-3 py-2 text-sm text-amber-950 transition-colors hover:bg-amber-100/80"
                        >
                          <span>
                            <strong>{n.employeeName}</strong> submitted an
                            appraisal
                          </span>
                          <span className="text-xs font-medium text-amber-800">
                            Open →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-label="Appraisal list">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {mode === "employee"
                    ? "Your appraisals"
                    : mode === "hr"
                      ? "Received from managers"
                      : "All appraisals"}
                </h2>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                {!list && !error && (
                  <p className="text-sm text-zinc-500">Loading…</p>
                )}
                {list && list.length === 0 && (
                  <div className="rounded border border-dashed border-zinc-200 bg-white px-6 py-12 text-center">
                    {mode === "hr" ? (
                      <p className="text-sm text-zinc-600">
                        No appraisals on the server yet, or none have been
                        completed and sent to HR.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-600">
                          You haven&apos;t created an appraisal yet.
                        </p>
                        {mode === "employee" && user ? (
                          <button
                            type="button"
                            disabled={createBusy}
                            className="mt-4 rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => createAppraisalForOwner(user.id)}
                          >
                            {createBusy
                              ? "Creating…"
                              : "Create your first appraisal"}
                          </button>
                        ) : (
                          <p className="mt-4 text-xs text-zinc-500">
                            Use <strong>+ Add Appraisal</strong> above after
                            choosing an employee.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {visibleAppraisals &&
                  list &&
                  list.length > 0 &&
                  visibleAppraisals.length === 0 &&
                  mode === "employee" && (
                    <p className="text-sm text-zinc-600">
                      No appraisal is assigned to your account. Create one
                      above or sign in as another demo employee.
                    </p>
                  )}
                {visibleAppraisals &&
                  list &&
                  list.length > 0 &&
                  visibleAppraisals.length === 0 &&
                  mode === "hr" && (
                    <p className="text-sm text-zinc-600">
                      Nothing has been sent to HR yet. When a manager finishes a
                      review and clicks <strong>Complete Appraisal</strong>,
                      it will appear here.
                    </p>
                  )}
                {visibleAppraisals && visibleAppraisals.length > 0 && (
                  <>
                    <div className="-mx-4 mb-0 flex flex-col gap-2 border-y border-zinc-200 bg-white px-3 py-2.5 sm:-mx-5 sm:px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          placeholder="ID"
                          className="w-30 min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500"
                          aria-hidden
                        />
                        <input
                          type="text"
                          readOnly
                          placeholder="Employee"
                          className="w-30 min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500"
                          aria-hidden
                        />
                        <input
                          type="text"
                          readOnly
                          placeholder="Employee Name"
                          className="w-34 min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500"
                          aria-hidden
                        />
                        <input
                          type="text"
                          readOnly
                          placeholder="Appraisal Cycle"
                          className="w-38 min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500"
                          aria-hidden
                        />
                        <input
                          type="text"
                          readOnly
                          placeholder="Appraisal Template"
                          className="w-40 min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-500"
                          aria-hidden
                        />
                        <button
                          type="button"
                          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Filters{" "}
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                            1
                          </span>
                        </button>
                        <div className="ml-auto flex items-center gap-1.5">
                          <span className="text-xs text-zinc-500">
                            Sort by:
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-0.5 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                          >
                            Created On
                            <svg
                              className="h-3 w-3 text-zinc-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="-mx-4 overflow-x-auto sm:-mx-5">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-white text-xs font-medium uppercase tracking-wide text-zinc-500">
                            <th className="w-10 px-3 py-2.5" scope="col">
                              <span className="sr-only">Select</span>
                              <input
                                type="checkbox"
                                disabled
                                className="rounded border-zinc-300"
                                aria-hidden
                              />
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              Employee name
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              Status
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              Appraisal cycle
                            </th>
                            <th className="px-3 py-2.5" scope="col">
                              ID
                            </th>
                            <th
                              className="w-28 px-3 py-2.5 text-right"
                              scope="col"
                            >
                              <span className="sr-only">Activity</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleAppraisals.map((a) => (
                            <tr
                              key={a.id}
                              tabIndex={0}
                              className="cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-400"
                              onClick={() => router.push(`/appraisal/${a.id}`)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  router.push(`/appraisal/${a.id}`);
                                }
                              }}
                            >
                              <td className="px-3 py-2.5 align-middle">
                                <input
                                  type="checkbox"
                                  disabled
                                  className="rounded border-zinc-300"
                                  aria-hidden
                                />
                              </td>
                              <td className="px-3 py-2.5 font-medium text-zinc-900">
                                {appraisalListDisplayName(
                                  a,
                                  mode ?? "employee",
                                  user
                                )}
                              </td>
                              <td className="px-3 py-2.5 align-middle">
                                <span
                                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${statusBadge(a.status)}`}
                                >
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-zinc-700">
                                {erpAppraisalCycleLabel(cycleYear)}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-zinc-600">
                                {erpAppraisalDocId(cycleYear, a.id)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-zinc-500">
                                <span className="inline-flex items-center gap-2">
                                  <span title="Last updated">
                                    {deskRelativeTimeLabel(a.id)}
                                  </span>
                                  <span
                                    className="text-zinc-400"
                                    title="Comments"
                                    aria-hidden
                                  >
                                    0
                                  </span>
                                  <span
                                    className="text-zinc-400"
                                    title="Attachments"
                                    aria-hidden
                                  >
                                    0
                                  </span>
                                  <svg
                                    className="inline h-3.5 w-3.5 text-zinc-300"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                    aria-hidden
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                    />
                                  </svg>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="-mx-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-500 sm:-mx-5 sm:px-5">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-zinc-400">Rows per page:</span>
                        {([20, 100, 500, 2500] as const).map((n, i) => (
                          <span key={n}>
                            {i > 0 && (
                              <span className="text-zinc-300"> · </span>
                            )}
                            <button
                              type="button"
                              className={
                                n === 20
                                  ? "font-semibold text-zinc-800"
                                  : "text-zinc-500 hover:text-zinc-800"
                              }
                            >
                              {n}
                            </button>
                          </span>
                        ))}
                      </div>
                      <span className="text-zinc-500">
                        {visibleAppraisals.length} of{" "}
                        {visibleAppraisals.length}
                      </span>
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
