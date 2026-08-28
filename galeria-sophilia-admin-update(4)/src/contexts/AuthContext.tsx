/**
 * src/contexts/AuthContext.tsx
 * ----------------------------------------------------
 * Sumber kebenaran tunggal untuk "siapa yang sedang login & apa role-nya".
 * Dipasang di root `App.tsx` (di luar routing) supaya `LoginPage` (untuk
 * redirect pasca-login) maupun `ProtectedRoute` / `RequireRole` (untuk
 * guard) memakai data yang sama, tanpa masing-masing halaman fetch
 * `/users/me` sendiri-sendiri seperti sebelumnya.
 *
 * Hanya melakukan fetch kalau ada token di localStorage — halaman publik
 * (ScanPage, VisitorForm, dst.) tidak memicu request apa pun.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet, getAccessToken, forceLogout } from "../api/client";
import { UserStaff } from "../types";

interface AuthContextValue {
  user: UserStaff | null;
  isLoading: boolean;
  error: string | null;
  /** Fetch ulang profil user (dipanggil LoginPage tepat setelah token baru disimpan). */
  refetch: () => Promise<UserStaff | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserStaff | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!!getAccessToken());
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<UserStaff | null> => {
    if (!getAccessToken()) {
      setUser(null);
      setIsLoading(false);
      return null;
    }
    try {
      setIsLoading(true);
      setError(null);
      const fetched = await apiGet<UserStaff>("/users/me");
      setUser(fetched);
      return fetched;
    } catch (err) {
      setUser(null);
      setError(err instanceof Error ? err.message : "Gagal memuat profil staf.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Muat profil sekali saat aplikasi pertama kali dibuka, hanya jika token ada.
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    forceLogout();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, refetch, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth() harus dipakai di dalam <AuthProvider>.");
  }
  return ctx;
}
