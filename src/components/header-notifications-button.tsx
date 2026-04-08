"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/contexts/session-context";

type ManagerNotification = {
  id: string;
  appraisalId: string;
  employeeName: string;
  createdAt: string;
};

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/**
 * Top-right notification control: managers see pending appraisal reviews; others see an empty state.
 */
export function HeaderNotificationsButton() {
  const { mode, managerProfile } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ManagerNotification[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (mode !== "manager" || !managerProfile) {
      setItems([]);
      return;
    }
    const res = await fetch(
      `/api/notifications?managerId=${encodeURIComponent(managerProfile.id)}`
    );
    if (!res.ok) return;
    const data = (await res.json()) as ManagerNotification[];
    setItems(data);
  }, [mode, managerProfile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = items.length;
  const isManager = mode === "manager" && managerProfile;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            if (next && isManager) void refresh();
            return next;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-black"
        aria-label={
          isManager
            ? `Notifications${count ? `, ${count} pending` : ""}`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon className="h-5 w-5" />
        {isManager && count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-zinc-200 bg-white py-2 shadow-lg"
          role="menu"
        >
          <p className="border-b border-zinc-100 px-3 pb-2 text-xs font-semibold text-black">
            Notifications
          </p>
          {!isManager && (
            <p className="px-3 py-4 text-sm text-zinc-600">
              Sign in as a manager to see appraisal submissions waiting for your
              review.
            </p>
          )}
          {isManager && count === 0 && (
            <p className="px-3 py-4 text-sm text-zinc-600">
              No pending reviews right now.
            </p>
          )}
          {isManager && count > 0 && (
            <ul className="max-h-72 overflow-y-auto py-1">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/appraisal/${n.appraisalId}`}
                    role="menuitem"
                    className="block px-3 py-2.5 text-sm text-black transition hover:bg-zinc-50"
                    onClick={() => setOpen(false)}
                  >
                    <span className="font-medium">{n.employeeName}</span>
                    <span className="block text-xs text-zinc-500">
                      Submitted an appraisal · Open review
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
