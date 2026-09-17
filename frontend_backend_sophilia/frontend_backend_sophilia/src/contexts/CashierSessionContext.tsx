/**
 * CashierSessionContext.tsx — BARU
 * ----------------------------------------------------
 * Sumber kebenaran tunggal "sesi kasir saya di sesi operasional ini":
 * siapa yang berjaga, dan TERMINAL PEMBAYARAN mana yang ada di mejanya.
 *
 * KENAPA ADA: daftar terminal dibutuhkan di tiga tempat sekaligus dalam
 * satu halaman — pop-up konfirmasi pembayaran, modal Tambah Manual, dan
 * modal Edit Transaksi. Tanpa satu sumber bersama, ketiganya akan
 * memanggil endpoint yang sama sendiri-sendiri dan bisa menampilkan
 * daftar terminal yang berbeda setelah kasir mengganti pilihannya.
 *
 * Memakai `GET /cashier-sessions/me/active` yang SELALU membalas 200 —
 * "kasir belum membuka sesinya" adalah keadaan normal (justru itulah yang
 * memicu gerbang "Buka Sesi Kasir"), bukan error. Pola yang sama dengan
 * `ActiveSessionContext`.
 *
 * CATATAN ROLE: endpoint di atas dijaga `current_kasir` (admin & kasir).
 * Checker sengaja TIDAK memicu permintaan apa pun dari sini — ia memang
 * tidak pernah menagih pembayaran, dan memanggilnya hanya akan
 * menghasilkan 403 yang tidak berguna di konsol.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "../api/client";
import { useAuth } from "./AuthContext";
import {
  CashierSession,
  CashierSessionStatus,
  PaymentTerminal,
} from "../types";

interface CashierSessionContextValue {
  /** Sesi kasir yang sedang terbuka untuk sesi operasional ini, atau null. */
  cashierSession: CashierSession | null;
  /**
   * Terminal yang boleh dipakai untuk menagih.
   *
   * Untuk KASIR: persis terminal yang ia pilih saat membuka sesi kasir.
   * Untuk ADMIN yang belum membuka sesi kasir: seluruh terminal aktif —
   * admin adalah peran override di seluruh sistem ini, dan backend
   * (`_resolve_terminal`) memang mengizinkannya memakai terminal mana pun
   * tanpa sesi kasir. Tanpa keringanan ini, admin yang sekadar
   * membereskan antrean kasir hanya bisa mencatat pembayaran tunai.
   */
  terminals: PaymentTerminal[];
  isLoading: boolean;
  /** Terisi hanya untuk kegagalan jaringan/server — bukan untuk "belum dibuka". */
  error: string | null;
  /** True kalau role yang sedang login memang mengoperasikan kasir. */
  isCashierRole: boolean;
  reload: () => Promise<void>;
  /** Membuka sesi kasir dengan terminal terpilih. Melempar ApiError kalau gagal. */
  openCashierSession: (terminalIds: string[]) => Promise<CashierSession>;
  closeCashierSession: () => Promise<void>;
}

const CashierSessionContext = createContext<CashierSessionContextValue | undefined>(undefined);

interface ProviderProps {
  /** Sesi operasional yang sedang dibuka di halaman detail. */
  sessionId: string;
  children: React.ReactNode;
}

export const CashierSessionProvider: React.FC<ProviderProps> = ({ sessionId, children }) => {
  const { user } = useAuth();
  const isCashierRole = user?.role === "admin" || user?.role === "kasir";

  const isAdmin = user?.role === "admin";

  const [cashierSession, setCashierSession] = useState<CashierSession | null>(null);
  const [allTerminals, setAllTerminals] = useState<PaymentTerminal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(isCashierRole);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isCashierRole || !sessionId) {
      setCashierSession(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiGet<CashierSessionStatus>(
        `/cashier-sessions/me/active?session_id=${sessionId}`
      );
      setCashierSession(data.cashier_session);

      // Cadangan khusus admin — lihat catatan pada `terminals` di atas.
      if (isAdmin && !data.cashier_session) {
        setAllTerminals(await apiGet<PaymentTerminal[]>("/payment-terminals"));
      } else {
        setAllTerminals([]);
      }
    } catch (err) {
      setCashierSession(null);
      setError(err instanceof ApiError ? err.message : "Gagal memuat sesi kasir.");
    } finally {
      setIsLoading(false);
    }
  }, [isCashierRole, isAdmin, sessionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openCashierSession = useCallback(
    async (terminalIds: string[]): Promise<CashierSession> => {
      const created = await apiPost<CashierSession>("/cashier-sessions", {
        session_id: sessionId,
        terminal_ids: terminalIds,
      });
      setCashierSession(created);
      setError(null);
      return created;
    },
    [sessionId]
  );

  const closeCashierSession = useCallback(async () => {
    if (!cashierSession) return;
    await apiPatch(`/cashier-sessions/${cashierSession.id}/close`);
    setCashierSession(null);
  }, [cashierSession]);

  const value = useMemo<CashierSessionContextValue>(
    () => ({
      cashierSession,
      terminals: cashierSession?.terminals ?? allTerminals,
      isLoading,
      error,
      isCashierRole,
      reload,
      openCashierSession,
      closeCashierSession,
    }),
    [cashierSession, allTerminals, isLoading, error, isCashierRole, reload, openCashierSession, closeCashierSession]
  );

  return <CashierSessionContext.Provider value={value}>{children}</CashierSessionContext.Provider>;
};

export function useCashierSession(): CashierSessionContextValue {
  const ctx = useContext(CashierSessionContext);
  if (!ctx) {
    throw new Error("useCashierSession() harus dipakai di dalam <CashierSessionProvider>.");
  }
  return ctx;
}
