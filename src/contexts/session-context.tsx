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
  DEMO_MANAGER,
  findMockUser,
  type MockUser,
} from "@/lib/mock-users";

const USER_KEY = "aemg-appraisal-user-id";
const MODE_KEY = "aemg-session-mode";
const MANAGER_ID_KEY = "aemg-manager-id";

export type SessionMode = "employee" | "manager";

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
  /** Employee: own appraisal only. */
  loginEmployee: (userId: string) => void;
  /** Manager demo: Mark reviews direct reports in-app. */
  loginManager: () => void;
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
          setManagerProfile({
            id: DEMO_MANAGER.id,
            displayName: DEMO_MANAGER.displayName,
          });
        } else if (m === "employee") {
          const u = id ? findMockUser(id) : undefined;
          setMode("employee");
          setUser(u ?? null);
          setManagerProfile(null);
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
    try {
      localStorage.setItem(MODE_KEY, "manager");
      localStorage.setItem(MANAGER_ID_KEY, DEMO_MANAGER.id);
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setMode(null);
    setUser(null);
    setManagerProfile(null);
    try {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MANAGER_ID_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const isAuthenticated = mode === "manager" || (mode === "employee" && user != null);

  const value = useMemo(
    () => ({
      ready,
      mode,
      user,
      managerProfile,
      loginEmployee,
      loginManager,
      logout,
      isAuthenticated,
    }),
    [
      ready,
      mode,
      user,
      managerProfile,
      loginEmployee,
      loginManager,
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
