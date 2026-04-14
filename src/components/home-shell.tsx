"use client";

import { Suspense } from "react";
import { useSession } from "@/contexts/session-context";
import { HomeContent } from "@/components/home-content";
import { LoginContent } from "@/components/login-content";
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
      <div className="flex min-h-full flex-1 flex-col bg-[#F3F4F6] text-black">
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
