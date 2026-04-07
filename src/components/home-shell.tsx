"use client";

import { Suspense } from "react";
import { useSession } from "@/contexts/session-context";
import { HomeContent } from "@/components/home-content";
import { LoginContent } from "@/components/login-content";
import { entityShellClass } from "@/lib/entity-theme";

export function HomeShell() {
  const { ready, isAuthenticated } = useSession();

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={entityShellClass(null)}>
        <LoginContent />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-1 items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
