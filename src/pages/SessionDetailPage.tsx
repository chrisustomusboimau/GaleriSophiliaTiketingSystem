/**
 * src/pages/SessionDetailPage.tsx
 * ----------------------------------------------------
 * Halaman `/sesi/:sessionId`. Tiga tab, SEMUA terfilter ke sesi ini:
 * - Antrian Kasir      (dulu tab di /admin)
 * - Riwayat Transaksi  (dulu halaman /admin/history)
 * - Ringkasan          (dulu halaman terpisah /admin/summary — SEKARANG
 *   digabung di sini, dan Audit Tiket [dulu tab admin terpisah] ikut
 *   melebur ke dalamnya. Lihat `src/components/Summary.tsx`.)
 *
 * RBAC (per revisi):
 * - Admin bisa membuka halaman ini untuk sesi berstatus apa pun.
 * - Kasir/checker HANYA bisa membuka halaman ini untuk sesi yang SEDANG
 *   'opened'. Kalau mereka nyasar ke sini untuk sesi draft/closed (mis.
 *   lewat bookmark lama, atau sesi baru saja ditutup admin), mereka
 *   diblokir dengan pesan jelas + tombol kembali ke /sesi.
 *
 * Data transaksi sesi ini di-fetch SEKALI di level halaman (bukan per
 * tab) lalu dibagi ke tab Riwayat & Ringkasan, lewat
 * `GET /transactions/all?session_id=<id>`. Hasilnya TETAP difilter
 * `tx.session_id === sessionId` di client: backend yang belum mengenal
 * parameter itu akan mengembalikan seluruh histori.
 *
 * Ekspor Excel per sesi dibangun client-side dari data yang sama, dan
 * tombolnya hanya dirender untuk ADMIN.
 *
 * UPDATE v2 — GERBANG "BUKA SESI KASIR":
 * Sebelum bisa masuk ke tab mana pun, KASIR harus melewati dua langkah:
 *   1. memilih TERMINAL PEMBAYARAN yang ada di mejanya (sesi kasir), dan
 *   2. mengisi NOMOR TIKET FISIK AWAL (gerbang lama, tidak berubah).
 * Tanpa langkah 1, pop-up konfirmasi pembayaran tidak punya pilihan
 * terminal untuk ditawarkan — dan Metode Pembayaran Detail di riwayat
 * akan kosong selamanya.
 *
 * Admin tidak pernah digerbang (peran override), dan checker hanya
 * terkena gerbang nomor tiket awal — ia memang tidak menagih pembayaran.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { CashierSessionProvider, useCashierSession } from "../contexts/CashierSessionContext";
import { apiGet, ApiError } from "../api/client";
import { OperationalSession, TransactionEntry } from "../types";
import {
  formatDateID,
  toTimeInputValue,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_BADGE,
  SESSION_LIVE_LABEL,
  SESSION_LIVE_BADGE,
  ROLE_LABEL,
} from "../utils/formatters";
import { sessionExportFileName } from "../utils/excel";
import Header from "../components/Header";
import AdminDashboard from "../components/admin/AdminDashboard";
import SessionHistoryPanel from "../components/SessionHistoryPanel";
import ReportExportButton from "../components/ReportExportButton";
import Summary from "../components/Summary";
import SessionAuditForm from "../components/admin/SessionAuditForm";
import OpenCashierSessionPanel from "../components/admin/OpenCashierSessionPanel";

type TabKey = "antrian" | "riwayat" | "ringkasan";

/* =====================================================
   MAIN PAGE
===================================================== */

/**
 * Isi halaman. Dipisah dari komponen ekspor di bawah semata-mata supaya
 * ia berada DI DALAM `CashierSessionProvider` dan bisa memanggil
 * `useCashierSession()` — provider butuh `sessionId` dari route, jadi
 * tidak bisa dipasang di App.tsx seperti `ActiveSessionProvider`.
 */
const SessionDetailContent: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    cashierSession,
    isLoading: isLoadingCashierSession,
    reload: reloadCashierSession,
  } = useCashierSession();

  const [session, setSession] = useState<OperationalSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("antrian");

  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      setIsLoadingSession(true);
      setSessionError(null);
      const data = await apiGet<OperationalSession>(`/sessions/${sessionId}`);
      setSession(data);
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Gagal memuat sesi.");
    } finally {
      setIsLoadingSession(false);
    }
  }, [sessionId]);

  const loadTransactions = useCallback(async () => {
    if (!sessionId) return;
    try {
      setIsLoadingTransactions(true);
      setTransactionsError(null);
      const data = await apiGet<TransactionEntry[]>(`/transactions/all?session_id=${sessionId}`);
      setTransactions(data.filter((tx) => tx.session_id === sessionId));
    } catch (err) {
      setTransactionsError(err instanceof ApiError ? err.message : "Gagal mengambil transaksi sesi ini.");
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Array stabil supaya perhitungan Ringkasan tidak diulang di setiap render.
  const sessionList = useMemo(() => (session ? [session] : []), [session]);

  if (!user) return null;

  // Ekspor Excel PER SESI hanya untuk admin — kasir/checker tidak melihat
  // tombolnya sama sekali (ekspor multi-sesi ada di /laporan-gabungan).
  const exportSlot =
    user.role === "admin" && session ? (
      <ReportExportButton
        sessions={sessionList}
        transactions={transactions}
        fileName={sessionExportFileName(session)}
        label="Download Excel Per Sesi"
      />
    ) : null;

  // --- Guard RBAC: kasir/checker hanya boleh mengakses sesi yang 'opened'.
  // Sesi draft/closed hanya boleh diakses admin. ---
  const isForbiddenForRole = !isLoadingSession && !sessionError && session && user.role !== "admin" && session.status !== "opened";

  const gateReady = !isLoadingSession && !sessionError && !!session && !isForbiddenForRole;

  // --- Gerbang 1 (BARU): BUKA SESI KASIR. Kasir harus menyatakan terminal
  // pembayaran mana yang ada di mejanya sebelum mulai melayani — tanpa itu,
  // pop-up konfirmasi tidak punya pilihan terminal untuk ditawarkan dan
  // Metode Pembayaran Detail akan kosong selamanya.
  //
  // Hanya berlaku untuk KASIR: admin adalah peran override, dan checker
  // memang tidak pernah menagih pembayaran. ---
  const needsCashierSessionGate =
    gateReady && user.role === "kasir" && !isLoadingCashierSession && !cashierSession;

  // --- Gerbang 2 (LAMA, tidak berubah): WAJIB isi Nomor Tiket Awal.
  // Kasir/checker tidak bisa masuk ke tab mana pun selama ada tiket aktif
  // yang nomor awalnya belum diisi. ---
  const needsStartNumberGate =
    gateReady &&
    user.role !== "admin" &&
    !needsCashierSessionGate &&
    session!.active_tickets.some((st) => st.audit?.start_ticket_number == null);

  const isGated = needsCashierSessionGate || needsStartNumberGate;

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <Header clickable={false} />

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-bold tracking-widest uppercase bg-[#1a1a1a] text-[#fb9418] border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
              {user.email}
              <span className="bg-[#fb9418] text-black px-1.5 py-0.5 rounded text-[9px] font-black">{ROLE_LABEL[user.role] || user.role}</span>
            </div>

            <button
              onClick={() => navigate("/sesi")}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
            >
              <span className="hidden sm:inline">Daftar Sesi</span>
              <span className="sm:hidden">Sesi</span>
            </button>

            {(user.role === "admin" || user.role === "kasir") && (
              <button
                onClick={() => navigate("/laporan-gabungan")}
                className="hidden sm:inline text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
              >
                Laporan Gabungan
              </button>
            )}

            {user.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="hidden sm:inline text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
              >
                Manajemen Admin
              </button>
            )}

            <button
              onClick={logout}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-500 hover:bg-red-600 hover:text-[#fcfcfc] transition-all active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>

        {/* INFO SESI */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
          {isLoadingSession ? (
            <p className="text-gray-400 text-xs font-medium">Memuat info sesi...</p>
          ) : sessionError ? (
            <p className="text-red-400 text-xs font-medium">{sessionError}</p>
          ) : session ? (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[#fcfcfc] font-bold text-lg">{session.name}</h1>
              {/* "Berlangsung" (jam dinding di dalam rentang sesi) sengaja
                  tampil terpisah dari status — lihat catatan di
                  OperationalSessionManager.tsx. */}
              {session.is_live && (
                <span className={`text-[11px] px-2.5 py-1 rounded-full border mr-1.5 ${SESSION_LIVE_BADGE}`}>
                  ● {SESSION_LIVE_LABEL}
                </span>
              )}
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${SESSION_STATUS_BADGE[session.status]}`}>
                {SESSION_STATUS_LABEL[session.status]}
              </span>
              <span className="text-gray-400 text-xs font-mono">
                {formatDateID(session.date)} · {toTimeInputValue(session.start_time)}–{toTimeInputValue(session.end_time)}
              </span>
            </div>
          ) : null}
        </div>

        {/* TAB NAVIGATION — disembunyikan kalau akses ditolak atau digerbang isi nomor awal */}
        {!isForbiddenForRole && !isGated && (
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
            {(
              [
                { key: "antrian", label: "Antrian Kasir" },
                { key: "riwayat", label: "Riwayat Transaksi" },
                { key: "ringkasan", label: "Ringkasan" },
              ] as { key: TabKey; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key ? "border-[#fb9418] text-[#fb9418]" : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {sessionError ? (
          <div className="max-w-2xl mx-auto p-5 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm text-center">{sessionError}</div>
        ) : isForbiddenForRole ? (
          <div className="max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-2xl shadow-sm text-center space-y-4">
            <p className="text-gray-700 font-bold">
              Sesi ini berstatus <span className="text-black">{SESSION_STATUS_LABEL[session!.status]}</span> — kasir/checker hanya bisa
              mengakses sesi yang sedang <span className="text-black">Dibuka</span>.
            </p>
            <button
              onClick={() => navigate("/sesi")}
              className="px-5 py-2.5 bg-black text-[#fb9418] font-bold rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Kembali ke Daftar Sesi
            </button>
          </div>
        ) : needsCashierSessionGate ? (
          <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-5">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-black uppercase tracking-wide">Buka Sesi Kasir</h2>
              <p className="text-sm text-gray-500">
                Pilih terminal pembayaran yang ada di meja Anda untuk sesi ini. Hanya terminal yang Anda pilih
                di sini yang bisa dipakai menagih, dan namanya tercatat sebagai Metode Pembayaran Detail pada
                setiap transaksi.
              </p>
            </div>
            <OpenCashierSessionPanel onOpened={reloadCashierSession} />
          </div>
        ) : needsStartNumberGate ? (
          <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-5">
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold text-black uppercase tracking-wide">Lengkapi Nomor Tiket Awal</h2>
              <p className="text-sm text-gray-500">
                {user.role === "kasir"
                  ? "Isi nomor tiket fisik awal untuk setiap varian di bawah ini sebelum bisa mengakses Antrian Kasir, Riwayat Transaksi, dan Ringkasan sesi ini."
                  : "Menunggu kasir mengisi nomor tiket fisik awal untuk sesi ini."}
              </p>
            </div>
            <SessionAuditForm
              session={session!}
              canEdit={user.role === "kasir"}
              onSaved={(updated) => setSession(updated)}
              submitLabel="Simpan & Lanjutkan"
            />
          </div>
        ) : (
          session && (
            <>
              {activeTab === "antrian" && <AdminDashboard role={user.role} sessionId={sessionId} />}
              {activeTab === "riwayat" && (
                <SessionHistoryPanel
                  transactions={transactions}
                  isLoading={isLoadingTransactions}
                  onReload={loadTransactions}
                  role={user.role}
                  onViewSummary={() => setActiveTab("ringkasan")}
                  title="Riwayat Transaksi Sesi Ini"
                  description="Semua transaksi yang tercatat pada sesi ini, apapun statusnya."
                  exportSlot={exportSlot}
                />
              )}
              {activeTab === "ringkasan" && (
                <div className="w-full max-w-6xl mx-auto">
                  {transactionsError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{transactionsError}</div>
                  )}
                  <Summary sessions={sessionList} transactions={transactions} exportSlot={exportSlot} />
                </div>
              )}
            </>
          )
        )}
      </main>
    </div>
  );
};

/**
 * Komponen rute. Memasang `CashierSessionProvider` dengan `sessionId` dari
 * URL, lalu menyerahkan sisanya ke `SessionDetailContent` — semua modal di
 * dalamnya (konfirmasi pembayaran, tambah manual, edit transaksi) memakai
 * daftar terminal yang SATU dan sama dari provider ini.
 */
const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  if (!sessionId) return null;

  return (
    <CashierSessionProvider sessionId={sessionId}>
      <SessionDetailContent sessionId={sessionId} />
    </CashierSessionProvider>
  );
};

export default SessionDetailPage;
