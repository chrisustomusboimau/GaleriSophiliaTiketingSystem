/**
 * src/components/SessionHistoryPanel.tsx
 * ----------------------------------------------------
 * Tabel Riwayat Transaksi (filter status/metode, pencarian, edit & hapus)
 * untuk satu sesi (`/sesi/:sessionId`) maupun gabungan beberapa sesi
 * (`/laporan-gabungan`). Diekstrak dari `SessionDetailPage.tsx` supaya
 * kedua halaman memakai tampilan yang persis sama.
 *
 * Tombol ekspor tidak dimiliki komponen ini: pemanggil mengirim
 * `exportSlot` sesuai hak akses role-nya (atau tidak sama sekali).
 *
 * CATATAN MODAL EDIT: `EditTransactionModal` butuh `CashierSessionProvider`
 * (daftar terminal). Halaman detail sesi sudah memasangnya; Laporan
 * Gabungan tidak punya satu sesi tunggal, jadi ia mengirim
 * `provideCashierSession` dan modal dibungkus provider milik sesi
 * transaksi yang sedang diedit.
 */

import React, { useMemo, useState } from "react";
import { apiPatch, apiDelete } from "../api/client";
import { TransactionEntry, TransactionUpdatePayload, UserRole } from "../types";
import { PAYMENT_METHOD_LABEL, TRANSACTION_STATUS_LABEL } from "../utils/formatters";
import PaymentHistoryComponent from "./PaymentHistoryComponent";
import EditTransactionModal from "./admin/EditTransactionModal";
import { CashierSessionProvider } from "../contexts/CashierSessionContext";

interface SessionHistoryPanelProps {
  transactions: TransactionEntry[];
  isLoading: boolean;
  onReload: () => void;
  /** Role yang sedang login — menentukan hak edit per baris (lihat status tiket). */
  role: UserRole | null;
  onViewSummary: () => void;
  title: string;
  description: string;
  /** Tombol ekspor dari pemanggil; kosong = tidak ada tombol (mis. role tanpa hak ekspor). */
  exportSlot?: React.ReactNode;
  /** True kalau pemanggil TIDAK berada di dalam `CashierSessionProvider` (lihat catatan di atas). */
  provideCashierSession?: boolean;
}

const SessionHistoryPanel: React.FC<SessionHistoryPanelProps> = ({
  transactions,
  isLoading,
  onReload,
  role,
  onViewSummary,
  title,
  description,
  exportSlot,
  provideCashierSession = false,
}) => {
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
          tx.queue_number.toString().includes(q) ||
          // Terminal ikut dicari: "tunjukkan semua transaksi EDC 2 hari ini"
          // adalah pertanyaan pertama saat struk EDC tidak cocok.
          (tx.payment_method_detail || "").toLowerCase().includes(q);
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

  const editModal = (
    <EditTransactionModal
      isOpen={isModalOpen}
      onClose={() => setIsModalOpen(false)}
      transaction={selectedTx}
      onSave={handleSaveEdit}
      onDelete={handleDeleteTransaction}
      role={role}
    />
  );

  return (
    <div className="w-full max-w-6xl mx-auto text-black">
      <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">{title}</h3>
          <p className="text-gray-500 text-sm mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Cari kode tiket / nama / antrian / terminal..."
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

          {exportSlot}

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

      <PaymentHistoryComponent
        transactions={filteredTransactions}
        isLoading={isLoading}
        onEditClick={handleEditClick}
        role={role}
      />

      {provideCashierSession ? (
        selectedTx && (
          <CashierSessionProvider key={selectedTx.session_id} sessionId={selectedTx.session_id}>
            {editModal}
          </CashierSessionProvider>
        )
      ) : (
        editModal
      )}
    </div>
  );
};

export default SessionHistoryPanel;
