"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { signOut as ssoSignOut } from "next-auth/react";
import {
  DEMO_HR,
  DEMO_MANAGER,
  findMockUser,
  type MockUser,
} from "@/lib/mock-users";

const USER_KEY = "aemg-appraisal-user-id";
const MODE_KEY = "aemg-session-mode";
const MANAGER_ID_KEY = "aemg-manager-id";

export type SessionMode = "employee" | "manager" | "hr";

/**
 * The ERPNext-resolved identity behind a Microsoft sign-in, as returned by
 * /api/auth/session. Mirrors ErpnextIdentity in lib/erpnext-identity.
 */
type SsoIdentity = {
  employee: string;
  employeeName: string;
  designation: string | null;
  department: string | null;
  managerName: string | null;
  mLevel: number | null;
  entity: string | null;
  isManager: boolean;
  isHr: boolean;
};

/**
 * Present a real SSO user in the shape the rest of the app already speaks.
 *
 * `id` is the ERPNext Employee doc id (HR-EMP-00006), NOT a demo roster key
 * — that is what makes an SSO user distinguishable from emma/mark/john/hr
 * downstream, and it is why erpnextEmployeeIdForOwner has an HR-EMP-*
 * passthrough. Note findMockUser(id) returns undefined for these users by
 * design; anything that assumed the roster is exhaustive needs a fallback.
 */
function mockUserFromIdentity(identity: SsoIdentity): MockUser {
  return {
    id: identity.employee,
    employeeName: identity.employeeName,
    englishName: identity.employeeName,
    position: identity.designation ?? "",
    department: identity.department ?? "",
    mLevel: identity.mLevel ?? 3,
    managerName: identity.managerName ?? "",
    entity: identity.entity ?? "",
  };
}

/** HR outranks manager: an HR user who also has reports still lands in HR. */
function modeFromIdentity(identity: SsoIdentity): SessionMode {
  if (identity.isHr) return "hr";
  if (identity.isManager) return "manager";
  return "employee";
}

export type ManagerProfile = {
  id: string;
  displayName: string;
};

type SessionContextValue = {
  /** Set after reading localStorage (avoid login flash). */
  ready: boolean;
  mode: SessionMode | null;
  user: MockUser | null;
  /** Set when `mode === "manager"` (demo: Mark). */
  managerProfile: ManagerProfile | null;
  /** Set when `mode === "hr"` (demo inbox). */
  hrProfile: ManagerProfile | null;
  /** Employee: own appraisal only. */
  loginEmployee: (userId: string) => void;
  /** Manager demo: Mark reviews direct reports in-app. */
  loginManager: () => void;
  /** HR demo: view appraisals sent by managers. */
  loginHr: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  /** True when signed in via Microsoft rather than a demo login. */
  isSso: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [user, setUser] = useState<MockUser | null>(null);
  const [managerProfile, setManagerProfile] = useState<ManagerProfile | null>(
    null
  );
  const [hrProfile, setHrProfile] = useState<ManagerProfile | null>(null);
  /** True when this session came from Microsoft rather than a demo login. */
  const [isSso, setIsSso] = useState(false);

  useEffect(() => {
    let cancelled = false;

    /**
     * A real Microsoft session wins over whatever localStorage remembers:
     * it is server-verified, the demo mode is not. Checked first so an SSO
     * user never briefly renders as a demo user.
     */
    async function restore() {
      try {
        const res = await fetch("/api/auth/session");
        const data = (await res.json()) as { identity?: SsoIdentity } | null;
        if (cancelled) return false;
        if (data?.identity) {
          const identity = data.identity;
          const derived = modeFromIdentity(identity);
          setMode(derived);
          setUser(mockUserFromIdentity(identity));
          setIsSso(true);
          // Manager/HR views read displayName off these, so populate the one
          // matching the derived mode with the real person's name rather
          // than leaving the demo placeholder showing.
          setManagerProfile(
            derived === "manager"
              ? { id: identity.employee, displayName: identity.employeeName }
              : null
          );
          setHrProfile(
            derived === "hr"
              ? { id: identity.employee, displayName: identity.employeeName }
              : null
          );
          return true;
        }
      } catch {
        /* No SSO session, or the endpoint is unreachable - fall through to demo. */
      }
      return false;
    }

    void restore().then((hadSso) => {
      if (cancelled || hadSso) {
        if (!cancelled) setReady(true);
        return;
      }

      /**
       * A failed Microsoft sign-in must NOT fall through to whatever demo
       * account localStorage happens to remember.
       *
       * This is not hypothetical: signing in as a real user whose SSO
       * callback failed silently landed them in the demo HR account, fully
       * authenticated as somebody else, with no indication anything had
       * gone wrong. Clearing here means they land back on the login screen
       * with the actual error instead.
       */
      const hadAuthError = new URLSearchParams(window.location.search).has(
        "error"
      );
      if (hadAuthError) {
        clearDemoSession();
        setReady(true);
        return;
      }

      restoreDemoSession();
      setReady(true);
    });

    function clearDemoSession() {
      try {
        localStorage.removeItem(MODE_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(MANAGER_ID_KEY);
      } catch {
        /* ignore */
      }
    }

    function restoreDemoSession() {
      try {
        let m = localStorage.getItem(MODE_KEY) as SessionMode | null;
        const id = localStorage.getItem(USER_KEY);
        if (!m && id && findMockUser(id)) {
          m = "employee";
          localStorage.setItem(MODE_KEY, "employee");
        }
        if (m === "manager") {
          setMode("manager");
          setUser(null);
          setHrProfile(null);
          setManagerProfile({
            id: DEMO_MANAGER.id,
            displayName: DEMO_MANAGER.displayName,
          });
        } else if (m === "hr") {
          setMode("hr");
          setUser(null);
          setManagerProfile(null);
          setHrProfile({
            id: DEMO_HR.id,
            displayName: DEMO_HR.displayName,
          });
        } else if (m === "employee") {
          const u = id ? findMockUser(id) : undefined;
          setMode("employee");
          setUser(u ?? null);
          setManagerProfile(null);
          setHrProfile(null);
        }
      } catch {
        /* ignore */
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const loginEmployee = useCallback((userId: string) => {
    const u = findMockUser(userId);
    if (!u) return;
    setMode("employee");
    setUser(u);
    setManagerProfile(null);
    setHrProfile(null);
    try {
      localStorage.setItem(MODE_KEY, "employee");
      localStorage.setItem(USER_KEY, userId);
      localStorage.removeItem(MANAGER_ID_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const loginManager = useCallback(() => {
    setMode("manager");
    setUser(null);
    setManagerProfile({
      id: DEMO_MANAGER.id,
      displayName: DEMO_MANAGER.displayName,
    });
    setHrProfile(null);
    try {
      localStorage.setItem(MODE_KEY, "manager");
      localStorage.setItem(MANAGER_ID_KEY, DEMO_MANAGER.id);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const loginHr = useCallback(() => {
    setMode("hr");
    setUser(null);
    setManagerProfile(null);
    setHrProfile({
      id: DEMO_HR.id,
      displayName: DEMO_HR.displayName,
    });
    try {
      localStorage.setItem(MODE_KEY, "hr");
      localStorage.setItem(MANAGER_ID_KEY, DEMO_HR.id);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setMode(null);
    setUser(null);
    setManagerProfile(null);
    setHrProfile(null);
    try {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MANAGER_ID_KEY);
    } catch {
      /* ignore */
    }
    if (isSso) {
      // Clearing local state is not enough for a real session - the signed
      // cookie would survive and restore() would sign them straight back in.
      setIsSso(false);
      void ssoSignOut({ redirectTo: "/" });
    }
  }, [isSso]);

  const isAuthenticated =
    mode === "manager" ||
    mode === "hr" ||
    (mode === "employee" && user != null);

  const value = useMemo(
    () => ({
      ready,
      mode,
      user,
      managerProfile,
      hrProfile,
      loginEmployee,
      loginManager,
      loginHr,
      logout,
      isAuthenticated,
      isSso,
    }),
    [
      ready,
      mode,
      user,
      managerProfile,
      hrProfile,
      loginEmployee,
      loginManager,
      loginHr,
      logout,
      isAuthenticated,
      isSso,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
