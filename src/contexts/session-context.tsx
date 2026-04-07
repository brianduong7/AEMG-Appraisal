"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { findMockUser, type MockUser } from "@/lib/mock-users";

const USER_KEY = "aemg-appraisal-user-id";
const MODE_KEY = "aemg-session-mode";

export type SessionMode = "employee" | "manager";

type SessionContextValue = {
  /** Set after reading localStorage (avoid login flash). */
  ready: boolean;
  mode: SessionMode | null;
  user: MockUser | null;
  /** Employee: own appraisal only. */
  loginEmployee: (userId: string) => void;
  /** Manager demo: all appraisals, no employee profile. */
  loginManager: () => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [user, setUser] = useState<MockUser | null>(null);

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
        } else if (m === "employee") {
          const u = id ? findMockUser(id) : undefined;
          setMode("employee");
          setUser(u ?? null);
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
    try {
      localStorage.setItem(MODE_KEY, "employee");
      localStorage.setItem(USER_KEY, userId);
    } catch {
      /* ignore */
    }
  }, []);

  const loginManager = useCallback(() => {
    setMode("manager");
    setUser(null);
    try {
      localStorage.setItem(MODE_KEY, "manager");
      localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const logout = useCallback(() => {
    setMode(null);
    setUser(null);
    try {
      localStorage.removeItem(MODE_KEY);
      localStorage.removeItem(USER_KEY);
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
      loginEmployee,
      loginManager,
      logout,
      isAuthenticated,
    }),
    [ready, mode, user, loginEmployee, loginManager, logout, isAuthenticated]
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
