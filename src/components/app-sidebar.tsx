"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/contexts/session-context";
import {
  defaultAppraisalView,
  navCapabilitiesForSession,
  parseAppraisalView,
  type AppraisalNavView,
} from "@/lib/nav-roles";

const SIDEBAR_KEY = "aife-sidebar-open";

function IconCog({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.424.35.534.954.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconUser({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0"
      />
    </svg>
  );
}

function IconTeam({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
      />
    </svg>
  );
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

type NavItem = {
  view: AppraisalNavView;
  label: string;
  href: string;
  icon: "user" | "team" | "shield" | "cog";
};

/**
 * Full-height drawer that slides in from the left.
 * Closed: only a pop-out tab on the left edge.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mode, user, managerProfile, hrProfile } = useSession();
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "0") setOpen(false);
      else if (stored === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setOpenPersist = useCallback((next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setOpenPersist(!open);
  }, [open, setOpenPersist]);

  const managerId = managerProfile?.id ?? hrProfile?.id ?? null;
  const caps = useMemo(
    () => navCapabilitiesForSession(mode, user, managerId),
    [mode, user, managerId]
  );

  const activeView = useMemo(() => {
    if (pathname?.startsWith("/appraisal/")) return null;
    return parseAppraisalView(searchParams.get("view"), caps);
  }, [pathname, searchParams, caps]);

  const items = useMemo((): NavItem[] => {
    const out: NavItem[] = [];
    if (caps.canMyAppraisal) {
      out.push({
        view: "my",
        label: "My Appraisals",
        href: "/?view=my",
        icon: "user",
      });
    }
    if (caps.canMyTeam) {
      out.push({
        view: "team",
        label: "My Team Appraisals",
        href: "/?view=team",
        icon: "team",
      });
    }
    if (caps.canSuperAdmin) {
      out.push({
        view: "admin",
        label: "Super Admin",
        href: "/?view=admin",
        icon: "shield",
      });
    }
    return out;
  }, [caps]);

  if (!mode || !ready) return null;

  function navLinkClass(active: boolean) {
    return `group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-white/12 text-white shadow-sm ring-1 ring-gold-400/40"
        : "text-white/65 hover:bg-white/6 hover:text-white"
    }`;
  }

  function iconClass(active: boolean) {
    return `h-5 w-5 shrink-0 ${
      active ? "text-gold-400" : "text-white/50 group-hover:text-gold-300"
    }`;
  }

  return (
    <>
      {/* Scrim when open — click to close */}
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        className={`fixed inset-0 z-40 bg-navy-950/35 transition-opacity duration-300 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpenPersist(false)}
      />

      {/* Pop-out tab — always on the left edge when closed */}
      {!open && (
        <button
          type="button"
          onClick={toggle}
          className="fixed left-0 top-1/2 z-50 flex h-14 w-8 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-navy-700 bg-navy-950 text-gold-400 shadow-lg shadow-navy-950/40 transition hover:w-9 hover:bg-navy-900 hover:text-gold-300"
          title="Open appraisal menu"
          aria-label="Open appraisal menu"
          aria-expanded={false}
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      )}

      {/* Full-height slide-out panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy-950 text-white shadow-2xl shadow-navy-950/50 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Appraisal navigation"
        aria-hidden={!open}
      >
        <div className="flex items-center border-b border-white/10 px-3 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-400">
              Appraisal
            </p>
            <p className="truncate text-xs text-white/55">{caps.roleLabel}</p>
          </div>
        </div>

        {/* Edge pop handle — only control to close when open */}
        <button
          type="button"
          onClick={toggle}
          className="absolute top-1/2 -right-7 flex h-14 w-7 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-navy-700 bg-navy-950 text-gold-400 shadow-md transition hover:bg-navy-900 hover:text-gold-300"
          title="Close menu"
          aria-label="Close appraisal menu"
          aria-expanded={true}
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.25}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>

        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-2"
          aria-label="Under Appraisal"
        >
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Under Appraisal
          </p>
          {items.map((item) => {
            const active =
              activeView === item.view ||
              (pathname === "/" &&
                activeView == null &&
                item.view === defaultAppraisalView(caps));
            const Icon =
              item.icon === "user"
                ? IconUser
                : item.icon === "team"
                  ? IconTeam
                  : IconShield;
            return (
              <Link
                key={item.view}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpenPersist(false)}
                className={navLinkClass(active)}
              >
                <Icon className={iconClass(active)} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {caps.canAdminSettings && (
          <div className="border-t border-white/10 p-2">
            <Link
              href="/?view=settings"
              title="Admin Settings"
              aria-current={activeView === "settings" ? "page" : undefined}
              onClick={() => setOpenPersist(false)}
              className={navLinkClass(activeView === "settings")}
            >
              <IconCog className={iconClass(activeView === "settings")} />
              <span className="truncate">Admin Settings</span>
            </Link>
          </div>
        )}

        <p className="border-t border-white/10 px-3 py-3 text-[10px] leading-relaxed text-white/35">
          Role-based menu. My Team shows direct reports only.
        </p>
      </aside>
    </>
  );
}
