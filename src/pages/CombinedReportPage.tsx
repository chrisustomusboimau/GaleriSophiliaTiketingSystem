/**
 * src/pages/CombinedReportPage.tsx — BARU
 * ----------------------------------------------------
 * Halaman `/laporan-gabungan`: laporan gabungan beberapa sesi dalam SATU
 * tanggal.
 *
 * Alur:
 *   1. Pilih tanggal.
 *   2. Sistem menampilkan sesi pada tanggal itu (Dibuka & Ditutup — sesi
 *      draft belum pernah berjalan, jadi disembunyikan).
 *   3. Centang sesi yang ingin digabung.
 *   4. Tab Riwayat Transaksi & Ringkasan menampilkan data gabungan, memakai
 *      komponen yang SAMA dengan halaman detail sesi (`SessionHistoryPanel`
 *      & `Summary`) supaya tampilannya identik.
 *   5. "Download Excel Multi-Sesi" → `Tiketing-YYYY-MM-DD.xlsx`.
 *
 * RBAC: rute dijaga `RequireRole allowed={["admin","kasir"]}` di App.tsx —
 * checker dialihkan ke /sesi. Ekspor multi-sesi boleh untuk admin & kasir,
 * jadi tombolnya selalu dirender di halaman ini. Workbook dibangun
 * client-side dari sesi & transaksi yang sudah dimuat halaman ini.
 *
 * Transaksi untuk tampilan diambil lewat
 * `GET /transactions/all?session_id=...` untuk semua sesi di tanggal itu,
 * lalu dipersempit ke sesi yang dicentang di client (mencentang/melepas
 * sesi tidak memicu request baru). Filter client ini juga yang menjamin
 * hasilnya benar kalau backend mengabaikan parameter `session_id`.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, ApiError } from "../api/client";
import { OperationalSession, TransactionEntry } from "../types";
import {
  formatDateID,
  toTimeInputValue,
  ROLE_LABEL,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_BADGE,
} from "../utils/formatters";
import { dateExportFileName } from "../utils/excel";
import Header from "../components/Header";
import SessionHistoryPanel from "../components/SessionHistoryPanel";
import ReportExportButton from "../components/ReportExportButton";
import Summary from "../components/Summary";

type TabKey = "riwayat" | "ringkasan";

const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

const CombinedReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [date, setDate] = useState<string>(getTodayString());
  const [sessions, setSessions] = useState<OperationalSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [allTransactions, setAllTransactions] = useState<TransactionEntry[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("ringkasan");

  const loadSessions = useCallback(async () => {
    if (!date) {
      setSessions([]);
      setIsLoadingSessions(false);
      return;
    }
    try {
      setIsLoadingSessions(true);
      setSessionsError(null);
      const data = await apiGet<OperationalSession[]>(`/sessions?date=${date}`);
      setSessions(
        data
          .filter((s) => s.status !== "draft")
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
    } catch (err) {
      setSessionsError(err instanceof ApiError ? err.message : "Gagal memuat daftar sesi.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [date]);

  const loadTransactions = useCallback(async () => {
    if (sessions.length === 0) {
      setAllTransactions([]);
      setIsLoadingTransactions(false);
      return;
    }
    try {
      setIsLoadingTransactions(true);
      setTransactionsError(null);
      const qs = sessions.map((s) => `session_id=${s.id}`).join("&");
      const data = await apiGet<TransactionEntry[]>(`/transactions/all?${qs}`);
      setAllTransactions(data);
    } catch (err) {
      setTransactionsError(err instanceof ApiError ? err.message : "Gagal mengambil transaksi.");
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [sessions]);

  // Ganti tanggal = daftar sesi baru, jadi pilihan lama dibuang.
  useEffect(() => {
    setSelectedIds(new Set());
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const selectedSessions = useMemo(() => sessions.filter((s) => selectedIds.has(s.id)), [sessions, selectedIds]);

  const selectedTransactions = useMemo(
    () => allTransactions.filter((tx) => selectedIds.has(tx.session_id)),
    [allTransactions, selectedIds]
  );

  const toggleSession = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = sessions.length > 0 && selectedIds.size === sessions.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sessions.map((s) => s.id)));
  };

  if (!user) return null;

  const exportSlot =
    selectedSessions.length > 0 ? (
      <ReportExportButton
        sessions={selectedSessions}
        transactions={selectedTransactions}
        fileName={dateExportFileName(date)}
        label="Download Excel Multi-Sesi"
      />
    ) : null;

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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex flex-wrap items-center gap-3">
          <h1 className="text-[#fcfcfc] font-bold text-lg">Laporan Gabungan</h1>
          {date && <span className="text-gray-400 text-xs font-mono">{formatDateID(date)}</span>}
        </div>

        {selectedSessions.length > 0 && (
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
            {(
              [
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

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* PILIH TANGGAL & SESI */}
        <div className="w-full max-w-6xl mx-auto bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-200 text-black space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h3 className="font-bold text-lg text-black uppercase tracking-wide">Pilih Tanggal & Sesi</h3>
              <p className="text-gray-500 text-sm mt-1">Centang sesi yang ingin digabung menjadi satu laporan.</p>
            </div>
            <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-[#fb9418] focus-within:border-[#fb9418] self-start sm:self-auto">
              <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-bold text-black outline-none bg-transparent cursor-pointer"
                title="Tanggal laporan"
              />
            </div>
          </div>

          {sessionsError ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">{sessionsError}</div>
          ) : isLoadingSessions ? (
            <p className="text-gray-400 text-sm font-medium">Memuat daftar sesi...</p>
          ) : sessions.length === 0 ? (
            <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg">
              Tidak ada sesi Dibuka/Ditutup pada tanggal ini.
            </p>
          ) : (
            <>
              <label className="inline-flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-[#fb9418]" />
                Pilih semua ({sessions.length} sesi)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.map((s) => {
                  const checked = selectedIds.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        checked ? "border-[#fb9418] bg-orange-50/60" : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSession(s.id)}
                        className="mt-1 w-4 h-4 accent-[#fb9418]"
                      />
                      <div className="min-w-0 space-y-1">
                        <p className="font-bold text-black truncate">{s.name}</p>
                        <p className="text-xs font-mono text-gray-500">
                          {toTimeInputValue(s.start_time)}–{toTimeInputValue(s.end_time)}
                        </p>
                        <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${SESSION_STATUS_BADGE[s.status]}`}>
                          {SESSION_STATUS_LABEL[s.status]}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* HASIL GABUNGAN */}
        {sessions.length > 0 && selectedSessions.length === 0 && (
          <p className="max-w-6xl mx-auto text-center text-gray-400 italic text-sm">Pilih minimal satu sesi untuk menampilkan laporan.</p>
        )}

        {selectedSessions.length > 0 && (
          <>
            {activeTab === "riwayat" && (
              <SessionHistoryPanel
                transactions={selectedTransactions}
                isLoading={isLoadingTransactions}
                onReload={loadTransactions}
                role={user.role}
                onViewSummary={() => setActiveTab("ringkasan")}
                title="Riwayat Transaksi Gabungan"
                description="Semua transaksi dari sesi yang dipilih, apapun statusnya."
                exportSlot={exportSlot}
                provideCashierSession
              />
            )}
            {activeTab === "ringkasan" && (
              <div className="w-full max-w-6xl mx-auto">
                {transactionsError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{transactionsError}</div>
                )}
                <Summary sessions={selectedSessions} transactions={selectedTransactions} exportSlot={exportSlot} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CombinedReportPage;
