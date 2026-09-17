/**
 * ActiveSessionContext.tsx — BARU
 * ----------------------------------------------------
 * Satu-satunya sumber kebenaran "apakah ada sesi penjualan yang sedang
 * berjalan sekarang" untuk seluruh alur pembelian publik.
 *
 * KENAPA ADA: sebelumnya `TicketSelectionPage` dan `VisitorForm`
 * masing-masing memanggil `GET /sessions/active` sendiri-sendiri, dengan
 * penanganan error yang mirip tapi tidak identik — dua permintaan jaringan
 * untuk satu alur, dan dua tempat berbeda yang bisa keluar-jalur. Sekarang
 * pengambilan datanya di sini sekali, lalu dipakai bersama oleh penjaga
 * rute (`RequireActiveSession`) maupun halaman-halamannya.
 *
 * Memakai `GET /sessions/active/status` yang SELALU membalas 200 — "galeri
 * sedang tutup" adalah kondisi normal, bukan error, jadi tidak lagi
 * diperlakukan sebagai kegagalan (endpoint lama membalas 403).
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { apiGet, ApiError } from "../api/client";
import { ActiveSessionStatus, OperationalSession } from "../types";

interface ActiveSessionContextType {
  /** Sesi yang sedang berjalan, atau null kalau tidak ada. */
  session: OperationalSession | null;
  /** True hanya kalau backend memastikan ada sesi berjalan. */
  hasActive: boolean;
  isLoading: boolean;
  /** Terisi hanya untuk kegagalan JARINGAN/SERVER — bukan untuk "tidak ada sesi". */
  error: string | null;
  /** Muat ulang status (dipakai tombol "Periksa Lagi"). Mengembalikan hasil terbaru. */
  reload: () => Promise<boolean>;
}

const ActiveSessionContext = createContext<ActiveSessionContextType | undefined>(undefined);

export const ActiveSessionProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<OperationalSession | null>(null);
  const [hasActive, setHasActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<ActiveSessionStatus>("/sessions/active/status", {
        skipAuthRedirect: true,
      });
      setSession(data.session);
      setHasActive(Boolean(data.has_active));
      return Boolean(data.has_active);
    } catch (err) {
      // Jaringan/server bermasalah. Diperlakukan sama seperti "tidak ada
      // sesi" untuk urusan akses (pengunjung tetap dialihkan ke halaman
      // fallback), tapi pesannya disimpan supaya bisa dibedakan.
      setSession(null);
      setHasActive(false);
      setError(err instanceof ApiError ? err.message : "Gagal menghubungi server.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value: ActiveSessionContextType = { session, hasActive, isLoading, error, reload };

  return (
    <ActiveSessionContext.Provider value={value}>
      {/* Dipakai dua cara: sebagai layout-route (<Outlet />) di App.tsx,
          atau sebagai pembungkus biasa dengan children. */}
      {children ?? <Outlet />}
    </ActiveSessionContext.Provider>
  );
};

export const useActiveSession = () => {
  const context = useContext(ActiveSessionContext);
  if (!context) {
    throw new Error("useActiveSession must be used within an ActiveSessionProvider");
  }
  return context;
};
