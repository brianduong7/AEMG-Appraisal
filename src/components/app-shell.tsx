"use client";

import { Suspense, type ReactNode } from "react";
import { AifeHeader } from "@/components/aife-header";
import { AppSidebar } from "@/components/app-sidebar";

/**
 * Top bar + main content. Sidebar is a full-height left slide-out drawer
 * (fixed overlay), toggled by the edge pop-out arrow.
 */
export function AppShell({
  children,
  active,
}: {
  children: ReactNode;
  active: "list" | "detail";
}) {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col bg-[#f6f8fc] text-navy-950">
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <AifeHeader active={active} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
