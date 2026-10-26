import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthenticatedUser,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "@moneymind/shared";
import {
  api,
  clearAccessToken,
  refreshSession,
  setAccessToken,
  setUnauthorizedHandler,
} from "@/lib/api";
import { queryClient } from "@/providers/query-provider";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthenticatedUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Boots the session exactly once per page load by exchanging the HttpOnly
 * refresh cookie for a short-lived access token. Until that settles the app is
 * in `loading`, so guards never flash the login screen for a signed-in user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const mountedRef = useRef(true);

  const becomeAnonymous = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, []);

  const applySession = useCallback((session: { accessToken: string; user: AuthenticatedUser }) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
    setStatus("authenticated");
    queryClient.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setUnauthorizedHandler(() => {
      if (!mountedRef.current) return;
      becomeAnonymous();
    });

    void (async () => {
      try {
        const session = await refreshSession();
        if (!mountedRef.current) return;
        applySession(session);
      } catch {
        if (!mountedRef.current) return;
        becomeAnonymous();
      }
    })();

    return () => {
      mountedRef.current = false;
      setUnauthorizedHandler(null);
    };
  }, [applySession, becomeAnonymous]);

  const login = useCallback(
    async (input: LoginInput) => {
      const session = await api.login(input);
      applySession(session);
    },
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const session = await api.register(input);
      applySession(session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      becomeAnonymous();
    }
  }, [becomeAnonymous]);

  const logoutAll = useCallback(async () => {
    try {
      await api.logoutAll();
    } finally {
      becomeAnonymous();
    }
  }, [becomeAnonymous]);

  const updateProfile = useCallback(async (input: UpdateProfileInput) => {
    const { user: updated } = await api.updateProfile(input);
    setUser(updated);
    return updated;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === "authenticated",
      login,
      register,
      logout,
      logoutAll,
      updateProfile,
    }),
    [status, user, login, register, logout, logoutAll, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Throws outside the provider: protected UI must never guess who is signed in. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return context;
}

/**
 * For shared layout chrome that can render before/without a provider (unit
 * tests, static previews). Application routes should use `useAuth`.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
