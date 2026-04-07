"use client";

import { RatingGuideProvider } from "@/components/rating-guide-modal";
import { RoleProvider } from "@/contexts/role-context";
import { SessionProvider } from "@/contexts/session-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RoleProvider>
        <RatingGuideProvider>
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
        </RatingGuideProvider>
      </RoleProvider>
    </SessionProvider>
  );
}
