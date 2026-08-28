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
 * tab) lalu dibagi ke tab Riwayat & Ringkasan — backend belum punya
 * endpoint filter-by-session, jadi filternya tetap `tx.session_id ===
 * sessionId` di client.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPatch, apiDelete, ApiError } from "../api/client";
import { OperationalSession, TransactionEntry, TransactionUpdatePayload } from "../types";
import {
  formatDateID,
  toTimeInputValue,
  PAYMENT_METHOD_LABEL,
  TRANSACTION_STATUS_LABEL,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_BADGE,
  ROLE_LABEL,
} from "../utils/formatters";
import Header from "../components/Header";
import AdminDashboard from "../components/admin/AdminDashboard";
import PaymentHistoryComponent from "../components/PaymentHistoryComponent";
import EditTransactionModal from "../components/admin/EditTransactionModal";
import Summary from "../components/Summary";
import SessionAuditForm from "../components/admin/SessionAuditForm";

type TabKey = "antrian" | "riwayat" | "ringkasan";

/* =====================================================
   TAB: RIWAYAT TRANSAKSI (khusus sesi ini)
===================================================== */

interface SessionHistoryTabProps {
  transactions: TransactionEntry[];
  isLoading: boolean;
  onReload: () => void;
  canEdit: boolean;
  canDelete: boolean;
  onViewSummary: () => void;
}

const SessionHistoryTab: React.FC<SessionHistoryTabProps> = ({
  transactions,
  isLoading,
  onReload,
  canEdit,
  canDelete,
  onViewSummary,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionEntry | null>(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (paymentFilter !== "all" && tx.payment_method !== paymentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          tx.ticket_code.toLowerCase().includes(q) ||
          tx.customer_name.toLowerCase().includes(q) ||
          tx.queue_number.toString().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, paymentFilter, searchQuery]);

  const handleEditClick = (tx: TransactionEntry) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const handleSaveEdit = async (id: string, updatedData: TransactionUpdatePayload) => {
    const { items, origins, payment_method, customer_name, status } = updatedData;
    if (items || origins || payment_method || customer_name !== undefined) {
      await apiPatch(`/transactions/${id}/edit`, { items, origins, payment_method, customer_name });
    }
    if (status) {
      await apiPatch(`/transactions/${id}/status`, { status });
    }
    onReload();
  };

  const handleDeleteTransaction = async (id: string) => {
    await apiDelete(`/transactions/${id}`);
    onReload();
  };

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== "all") parts.push(TRANSACTION_STATUS_LABEL[statusFilter] || statusFilter);
    if (paymentFilter !== "all") parts.push(PAYMENT_METHOD_LABEL[paymentFilter] || paymentFilter);
    if (searchQuery.trim()) parts.push(`Cari: "${searchQuery.trim()}"`);
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [statusFilter, paymentFilter, searchQuery]);

  const handleExportExcel = async () => {
    if (filteredTransactions.length === 0) return;
    try {
      setIsExporting(true);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Riwayat Transaksi Sesi");

      worksheet.columns = [
        { header: "Kode Tiket", key: "ticket_code", width: 18 },
        { header: "No. Antrian", key: "queue_number", width: 15 },
        { header: "ID Transaksi", key: "id", width: 40 },
        { header: "Nama Pemesan", key: "customer_name", width: 25 },
        { header: "Tanggal", key: "date", width: 20 },
        { header: "Waktu Konfirmasi", key: "time", width: 20 },
        { header: "Rincian Tiket", key: "items_summary", width: 45 },
        { header: "Metode Pembayaran", key: "payment_method", width: 20 },
        { header: "Total Tagihan", key: "total_price", width: 25 },
        { header: "Status", key: "status", width: 15 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      });

      filteredTransactions.forEach((tx) => {
        const dateObj = new Date(tx.created_at || "");
        const dateStr = `${dateObj.getDate().toString().padStart(2, "0")}/${(dateObj.getMonth() + 1)
          .toString()
          .padStart(2, "0")}/${dateObj.getFullYear()}`;

        let timeStr = "Menunggu";
        if (tx.confirmed_at) {
          const confDate = new Date(tx.confirmed_at);
          timeStr = `${confDate.getHours().toString().padStart(2, "0")}:${confDate.getMinutes().toString().padStart(2, "0")}`;
        }

        const itemsSummary = tx.items.map((i) => `${i.quantity}x ${i.ticket_name_snapshot}`).join("; ");
        const pmStr = PAYMENT_METHOD_LABEL[tx.payment_method] || tx.payment_method?.toUpperCase() || "-";

        const row = worksheet.addRow({
          ticket_code: tx.ticket_code,
          queue_number: tx.queue_number,
          id: tx.id,
          customer_name: tx.customer_name,
          date: dateStr,
          time: timeStr,
          items_summary: itemsSummary,
          payment_method: pmStr,
          total_price: tx.total_price,
          status: TRANSACTION_STATUS_LABEL[tx.status] || tx.status,
        });
        row.getCell("total_price").numFmt = '"Rp"#,##0;[Red]\\-"Rp"#,##0';
      });

      const now = new Date();
      const suffix = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now
        .getDate()
        .toString()
        .padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Riwayat_Sesi_${suffix}.xlsx`);
    } catch (err) {
      console.error("Failed to export to Excel:", err);
      alert("Terjadi kesalahan saat mengekspor data.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto text-black">
      <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Riwayat Transaksi Sesi Ini</h3>
          <p className="text-gray-500 text-sm mt-1">Semua transaksi yang tercatat pada sesi ini, apapun statusnya.</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Cari kode tiket / nama / antrian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-[#fb9418] w-56"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border-gray-300 rounded-lg shadow-sm text-sm font-bold text-black focus:ring-[#fb9418] focus:border-[#fb9418] py-2 px-3 border outline-none cursor-pointer h-[38px]"
          >
            <option value="all">Semua Status</option>
            <option value="confirmed">Lunas / Dikonfirmasi</option>
            <option value="pending">Menunggu (Pending)</option>
            <option value="cancelled">Batal (Cancelled)</option>
          </select>

          <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white text-sm font-bold h-[38px]">
            {([
              { value: "all", label: "Semua" },
              { value: "qris", label: "QRIS" },
              { value: "card", label: "EDC" },
              { value: "cash", label: "Tunai" },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPaymentFilter(value)}
                className={`px-4 py-1 transition-colors focus:outline-none ${
                  paymentFilter === value ? (value === "card" ? "bg-black text-white" : "bg-[#fb9418] text-white") : "text-gray-600 hover:bg-gray-50"
                } ${value !== "all" ? "border-l border-gray-300" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={onViewSummary}
            className="text-sm font-bold px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 h-[38px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            Lihat Ringkasan
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExporting || filteredTransactions.length === 0}
            className="text-sm font-bold px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 h-[38px]"
          >
            {isExporting ? "Mengekspor..." : "Unduh Excel"}
          </button>

          <button
            onClick={onReload}
            className="text-sm font-bold px-4 py-2 bg-white border border-gray-300 rounded-lg text-black hover:bg-gray-50 transition-colors shadow-sm h-[38px]"
          >
            Refresh
          </button>
        </div>
      </div>

      {activeFilterLabel && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-gray-500 font-medium">Filter aktif:</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#fb9418] border border-orange-200">
            {activeFilterLabel}
            <span className="font-black text-black ml-1">{filteredTransactions.length} data</span>
          </span>
          <button
            onClick={() => {
              setStatusFilter("all");
              setPaymentFilter("all");
              setSearchQuery("");
            }}
            className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors underline underline-offset-2 ml-2"
          >
            Reset Filter
          </button>
        </div>
      )}

      <PaymentHistoryComponent transactions={filteredTransactions} isLoading={isLoading} onEditClick={handleEditClick} canEdit={canEdit} />

      <EditTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTx}
        onSave={handleSaveEdit}
        onDelete={handleDeleteTransaction}
        canDelete={canDelete}
      />
    </div>
  );
};

/* =====================================================
   MAIN PAGE
===================================================== */

const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

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
      const data = await apiGet<TransactionEntry[]>("/transactions/all");
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

  if (!user || !sessionId) return null;

  const canConfirmOrEdit = user.role === "admin" || user.role === "kasir";
  const canDelete = user.role === "admin";

  // --- Guard RBAC: kasir/checker hanya boleh mengakses sesi yang 'opened'.
  // Sesi draft/closed hanya boleh diakses admin. ---
  const isForbiddenForRole = !isLoadingSession && !sessionError && session && user.role !== "admin" && session.status !== "opened";

  // --- Gerbang WAJIB isi Nomor Tiket Awal (non-admin): kasir/checker
  // tidak bisa masuk ke tab Antrian/Riwayat/Ringkasan selama ada tiket
  // aktif yang nomor awalnya belum diisi. Admin selalu punya akses penuh
  // dan tidak pernah digerbang. ---
  const needsStartNumberGate =
    !isLoadingSession &&
    !sessionError &&
    !!session &&
    !isForbiddenForRole &&
    user.role !== "admin" &&
    session.active_tickets.some((st) => st.audit?.start_ticket_number == null);

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

        {/* INFO SESI */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
          {isLoadingSession ? (
            <p className="text-gray-400 text-xs font-medium">Memuat info sesi...</p>
          ) : sessionError ? (
            <p className="text-red-400 text-xs font-medium">{sessionError}</p>
          ) : session ? (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[#fcfcfc] font-bold text-lg">{session.name}</h1>
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
        {!isForbiddenForRole && !needsStartNumberGate && (
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
                <SessionHistoryTab
                  transactions={transactions}
                  isLoading={isLoadingTransactions}
                  onReload={loadTransactions}
                  canEdit={canConfirmOrEdit}
                  canDelete={canDelete}
                  onViewSummary={() => setActiveTab("ringkasan")}
                />
              )}
              {activeTab === "ringkasan" && (
                <div className="w-full max-w-6xl mx-auto">
                  {transactionsError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{transactionsError}</div>
                  )}
                  <Summary session={session} transactions={transactions} />
                </div>
              )}
            </>
          )
        )}
      </main>
    </div>
  );
};

export default SessionDetailPage;
