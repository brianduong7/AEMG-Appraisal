"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

  useEffect(() => {
    queueMicrotask(() => {
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
      setReady(true);
    });
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
  }, []);

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
