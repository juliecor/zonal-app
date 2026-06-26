import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";

import {
  authLogin, authLogout, authMe, authRegister, authRequestLoginOtp, authVerifyLoginOtp, authVerifyOtp,
  type AuthResponse, type AuthUser, type RegisterPayload, type RegisterResult,
} from "@/lib/api";

const TOKEN_KEY = "zv_auth_token";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResult>;
  verifyOtp: (userId: number, code: string) => Promise<void>;
  requestLoginOtp: (email: string) => Promise<{ user_id: number; resend_cooldown?: number }>;
  verifyLoginOtp: (userId: number, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a saved session on launch.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        if (t) {
          const u = await authMe(t);
          if (alive) {
            if (u) { setToken(t); setUser(u); }
            else await SecureStore.deleteItemAsync(TOKEN_KEY);
          }
        }
      } catch { /* ignore */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function persist(res: AuthResponse) {
    await SecureStore.setItemAsync(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }

  const value = useMemo<AuthState>(() => ({
    user, token, loading,
    async signIn(email, password) {
      await persist(await authLogin(email, password));
    },
    async register(payload) {
      const r = await authRegister(payload);
      if ("token" in r) await persist(r as AuthResponse);
      return r;
    },
    async verifyOtp(userId, code) {
      await persist(await authVerifyOtp(userId, code));
    },
    async requestLoginOtp(email) {
      return authRequestLoginOtp(email);
    },
    async verifyLoginOtp(userId, code) {
      await persist(await authVerifyLoginOtp(userId, code));
    },
    async signOut() {
      if (token) await authLogout(token);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
    },
    async refresh() {
      if (!token) return;
      const u = await authMe(token);
      if (u) setUser(u);
    },
  }), [user, token, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
