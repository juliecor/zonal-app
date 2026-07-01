import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

import {
  authLogin, authLogout, authMe, authRegister, authRequestLoginOtp, authVerifyLoginOtp, authVerifyOtp,
  deleteAccount as apiDeleteAccount,
  type AuthResponse, type AuthUser, type RegisterPayload, type RegisterResult,
} from "@/lib/api";

const TOKEN_KEY = "zv_auth_token";
const BIO_KEY = "zv_biometric"; // "1" = biometric app-lock enabled

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
  deleteAccount: () => Promise<void>; // permanently delete the account + data, then sign out
  refresh: () => Promise<void>;
  applyUser: (u: AuthUser) => void;   // update the cached user immediately (after editing profile)
  // Biometric app-lock (Face ID / fingerprint)
  biometricEnabled: boolean;
  locked: boolean;
  unlock: () => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [locked, setLocked] = useState(false);

  // Restore a saved session on launch (and lock it behind biometrics if enabled).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, bio] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(BIO_KEY),
        ]);
        const bioOn = bio === "1";
        if (alive) setBiometricEnabled(bioOn);
        if (t) {
          const u = await authMe(t);
          if (alive) {
            if (u) { setToken(t); setUser(u); if (bioOn) setLocked(true); }
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
    // The login/register/OTP responses omit avatar_url, so a fresh sign-in showed initials
    // instead of the user's S3 photo. Pull the full profile from /me (which includes it).
    try { const full = await authMe(res.token); if (full) setUser(full); } catch { /* ignore */ }
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
      setLocked(false);
    },
    async deleteAccount() {
      if (token) await apiDeleteAccount(token); // server wipes the account + data; throws on failure
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setLocked(false);
    },
    async refresh() {
      if (!token) return;
      const u = await authMe(token);
      if (u) setUser(u);
    },
    applyUser(u) { setUser(u); },
    biometricEnabled,
    locked,
    async unlock() {
      try {
        const r = await LocalAuthentication.authenticateAsync({
          promptMessage: "Unlock zonalvalue.ph",
          fallbackLabel: "Use device passcode",
        });
        if (r.success) { setLocked(false); return true; }
      } catch { /* ignore */ }
      return false;
    },
    async enableBiometric() {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hw || !enrolled) throw new Error("No Face ID or fingerprint is set up on this device.");
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: "Confirm to turn on biometric unlock" });
      if (!r.success) throw new Error("Couldn't verify — biometric unlock was not turned on.");
      await SecureStore.setItemAsync(BIO_KEY, "1");
      setBiometricEnabled(true);
    },
    async disableBiometric() {
      await SecureStore.deleteItemAsync(BIO_KEY);
      setBiometricEnabled(false);
      setLocked(false);
    },
  }), [user, token, loading, biometricEnabled, locked]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
