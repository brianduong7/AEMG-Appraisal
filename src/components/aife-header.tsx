"use client";

import { useEffect, useRef, useState } from "react";
import { AppLogo } from "@/components/app-logo";
import { HeaderNotificationsButton } from "@/components/header-notifications-button";
import { useSession } from "@/contexts/session-context";
import { navCapabilitiesForSession } from "@/lib/nav-roles";

export function AifeHeader({ active }: { active: "list" | "detail" }) {
  const { user, logout, mode, managerProfile, hrProfile } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const caps = navCapabilitiesForSession(
    mode,
    user,
    managerProfile?.id ?? hrProfile?.id ?? null
  );

  const displayName =
    mode === "hr" && hrProfile
      ? hrProfile.displayName
      : mode === "manager" && managerProfile
        ? managerProfile.displayName
        : user
          ? user.englishName || user.employeeName
          : "Employee";

  const initial =
    (mode === "employee" &&
      (user?.englishName || user?.employeeName)?.[0]?.toUpperCase()) ||
    (mode === "manager" && managerProfile?.displayName?.[0]?.toUpperCase()) ||
    (mode === "hr" && hrProfile?.displayName?.[0]?.toUpperCase()) ||
    "A";

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header className="aife-header-gradient z-40 shrink-0 text-white">
      <div className="flex items-center gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <AppLogo variant="header" className="brightness-110" />
          <nav
            className="hidden text-xs text-white/60 sm:block"
            aria-label="Breadcrumb"
          >
            <span className="font-medium text-white/90">Performance</span>
            <span className="mx-1.5 text-white/30">/</span>
            <span className="text-gold-300">Appraisal</span>
            {active === "detail" && (
              <>
                <span className="mx-1.5 text-white/30">/</span>
                <span className="text-white/80">Record</span>
              </>
            )}
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <HeaderNotificationsButton />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-sm font-bold text-navy-950 ring-2 ring-white/25 transition hover:ring-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-200"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              {initial}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border border-white/10 bg-navy-950/95 py-1 text-sm text-white shadow-xl backdrop-blur-sm"
              >
                <div className="border-b border-white/10 px-3.5 py-2.5">
                  <p className="truncate font-medium text-white">
                    {displayName}
                  </p>
                  <p className="truncate text-xs text-white/60">
                    {caps.roleLabel}
                  </p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full px-3.5 py-2.5 text-left text-gold-300 transition hover:bg-white/10 hover:text-gold-200"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
