/**
 * AdminDashboard.tsx (src/components/admin)
 * ----------------------------------------------------
 * Panel kasir untuk mengelola & mengonfirmasi antrian pembayaran.
 * UPDATE: rincian tiket sekarang dikelompokkan berdasarkan
 * `ticket_name_snapshot` (mis. "Tiket Lantai 1 - Dewasa") yang
 * datang langsung dari backend, bukan lagi field floor/age_category
 * statis. Nama pemesan (`customer_name`) juga ditampilkan.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { apiGet, apiPatch, apiDelete, ApiError } from "../../api/client";
import { TransactionEntry, TransactionUpdatePayload, UserRole } from "../../types";
import { formatCurrency, getMasterColorTheme, splitTicketSnapshot, PAYMENT_METHOD_LABEL } from "../../utils/formatters";
import EditTransactionModal from "./EditTransactionModal";
import ManualEntryModal from "./ManualEntryModal";
import SuccessQueueModal from "./SuccessQueueModal";

interface VisitorCardProps {
  visitor: TransactionEntry;
  isProcessing: boolean;
  canConfirm: boolean;
  onConfirmPayment: (id: string) => void;
  onEdit: (visitor: TransactionEntry) => void;
}

const Toast: React.FC<{ message: string; type: "success" | "error" }> = ({ message, type }) => (
  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
    <div
      className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-md ${
        type === "success" ? "bg-black/90 text-[#fb9418] border-[#fb9418]" : "bg-red-600 text-white border-red-400"
      }`}
    >
      {type === "success" ? (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="font-bold tracking-wide text-sm whitespace-nowrap">{message}</span>
    </div>
  </div>
);

const VisitorCard: React.FC<VisitorCardProps> = ({ visitor, isProcessing, canConfirm, onConfirmPayment, onEdit }) => {
  const groupedByMaster = useMemo(() => {
    const groups: Record<string, { name: string; quantity: number; unit_price: number }[]> = {};
    visitor.items.forEach((item) => {
      const { group, variant } = splitTicketSnapshot(item.ticket_name_snapshot);
      if (!groups[group]) groups[group] = [];
      groups[group].push({ name: variant || item.ticket_name_snapshot, quantity: item.quantity, unit_price: item.unit_price });
    });
    return groups;
  }, [visitor.items]);

  return (
    <div className="bg-[#fcfcfc] rounded-xl shadow-md overflow-hidden border border-gray-200 flex flex-col hover:shadow-lg transition-shadow">
      <header className="relative bg-black pt-5 pb-5 px-4 text-center border-b-2 border-[#fb9418]">
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          <span className="text-[10px] bg-[#1a1a1a] border border-gray-800 px-2 py-0.5 rounded shadow-inner font-mono text-gray-300">
            {new Date(visitor.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-[9px] opacity-60 uppercase tracking-widest text-gray-400">Ke-{visitor.queue_number} hari ini</span>
        </div>

        <h2 className="text-[#fcfcfc] text-[10px] font-light mb-2 tracking-[0.25em] uppercase opacity-80">Nomor Tiket</h2>
        <div className="text-xl sm:text-2xl font-extrabold text-[#fb9418] tracking-widest leading-none whitespace-nowrap">
          {visitor.ticket_code}
        </div>
        {visitor.customer_name && (
          <p className="text-gray-300 text-xs font-medium mt-2 truncate max-w-[85%] mx-auto">{visitor.customer_name}</p>
        )}
      </header>

      <div className="p-4 flex-1 flex flex-col bg-[#fcfcfc]">
        <div className="flex-1 space-y-4 mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rincian Tiket</p>

          {Object.entries(groupedByMaster).map(([masterName, variants]) => {
            const themeClass = getMasterColorTheme(masterName);
            return (
              <div key={masterName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className={`px-3 py-2 text-xs font-bold border-b uppercase tracking-wide ${themeClass}`}>{masterName}</div>
                <div className="p-2 space-y-1.5">
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[13px]">
                      <span className="text-black font-medium">{v.name}</span>
                      <div className="text-right">
                        <span className="text-gray-500 text-[11px] block leading-none">
                          {v.quantity} x {formatCurrency(v.unit_price)}
                        </span>
                        <span className="font-bold text-black">{formatCurrency(v.quantity * v.unit_price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {visitor.items.length === 0 && (
            <p className="text-gray-400 italic text-center py-4 text-sm bg-gray-50 rounded-lg border border-gray-200">Tidak ada tiket.</p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-300">
          <div className="flex justify-between items-end mb-5">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Total Tagihan</span>
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${
                  visitor.payment_method === "card"
                    ? "bg-gray-800 text-white border-gray-700"
                    : visitor.payment_method === "cash"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-green-100 text-green-700 border-green-200"
                }`}
              >
                {PAYMENT_METHOD_LABEL[visitor.payment_method] || visitor.payment_method}
              </span>
            </div>
            <span className="text-2xl font-black text-black leading-none">{formatCurrency(visitor.total_price)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onEdit(visitor)}
              disabled={isProcessing}
              className="flex-1 py-3 px-2 rounded-xl font-bold text-sm transition-all border border-gray-300 text-black bg-white hover:bg-gray-100 active:scale-95 disabled:opacity-50 shadow-sm"
            >
              Edit
            </button>
            {canConfirm && (
              <button
                onClick={() => onConfirmPayment(visitor.id)}
                disabled={isProcessing}
                className="flex-[2] py-3 px-4 rounded-xl font-bold text-sm transition-all bg-[#fb9418] text-[#fcfcfc] hover:bg-orange-500 active:scale-95 shadow-md shadow-orange-200 disabled:bg-gray-300"
              >
                {isProcessing ? "Memproses..." : "Konfirmasi"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminDashboardProps {
  role: UserRole | null;
  /** Sesi operasional yang sedang dilihat — antrian difilter ke sesi ini saja. */
  sessionId: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ role, sessionId }) => {
  const [visitors, setVisitors] = useState<TransactionEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<TransactionEntry | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [successTransaction, setSuccessTransaction] = useState<TransactionEntry | null>(null);

  const canConfirm = role === "admin" || role === "kasir";
  const canDelete = role === "admin";

  const loadVisitors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Backend belum punya filter by-session di endpoint ini, jadi kita
      // ambil seluruh antrian pending HARI INI lalu saring ke sesi yang
      // sedang dibuka di halaman ini.
      const data = await apiGet<TransactionEntry[]>("/transactions?status=pending");
      setVisitors(data.filter((tx) => tx.session_id === sessionId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengambil data dari server.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const filteredVisitors = useMemo(() => {
    if (!searchQuery.trim()) return visitors;
    const query = searchQuery.trim().toLowerCase();
    return visitors.filter(
      (v) =>
        v.ticket_code.toLowerCase().includes(query) ||
        v.queue_number.toString().includes(query) ||
        (v.customer_name || "").toLowerCase().includes(query)
    );
  }, [visitors, searchQuery]);

  const handlePaymentConfirmation = async (id: string) => {
    try {
      setProcessingId(id);
      setError(null);
      const currentTx = visitors.find((v) => v.id === id);

      await apiPatch(`/transactions/${id}/status`, { status: "confirmed" });

      setVisitors((prev) => prev.filter((v) => v.id !== id));

      if (currentTx) {
        setSuccessMessage(`Tiket ${currentTx.ticket_code} Berhasil Dikonfirmasi`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengonfirmasi transaksi.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditClick = (visitor: TransactionEntry) => {
    setSelectedVisitor(visitor);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (id: string, updatedData: TransactionUpdatePayload) => {
    try {
      const { items, origins, payment_method, customer_name, status } = updatedData;
      if (items || origins || payment_method || customer_name !== undefined) {
        await apiPatch(`/transactions/${id}/edit`, { items, origins, payment_method, customer_name });
      }
      if (status) {
        await apiPatch(`/transactions/${id}/status`, { status });
      }
      setSuccessMessage("Perubahan Berhasil Disimpan");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadVisitors();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan.");
      setTimeout(() => setError(null), 3000);
      throw err;
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const currentTx = visitors.find((v) => v.id === id);
      await apiDelete(`/transactions/${id}`);
      setVisitors((prev) => prev.filter((v) => v.id !== id));
      setSuccessMessage(currentTx ? `Tiket ${currentTx.ticket_code} Telah Dihapus` : "Antrian Telah Dihapus");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus data.");
      setTimeout(() => setError(null), 3000);
      throw err;
    }
  };

  const handleManualEntrySuccess = (transaction: TransactionEntry) => {
    setSuccessTransaction(transaction);
    setSuccessMessage(`Tiket ${transaction.ticket_code} Berhasil Dibuat`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCloseSuccessModal = () => {
    setSuccessTransaction(null);
    loadVisitors();
  };

  useEffect(() => {
    loadVisitors();
    const intervalId = setInterval(loadVisitors, 30_000);
    return () => clearInterval(intervalId);
  }, [loadVisitors]);

  return (
    <div className="w-full max-w-6xl mx-auto relative flex flex-col text-black">
      {successMessage && <Toast message={successMessage} type="success" />}
      {error && <Toast message={error} type="error" />}

      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-gray-200 pb-5">
        <h3 className="font-bold text-black text-lg whitespace-nowrap flex items-center gap-3">
          Menunggu Konfirmasi
          <span className="text-sm font-black text-[#fcfcfc] bg-[#fb9418] px-3 py-1 rounded-full shadow-sm">{filteredVisitors.length}</span>
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari Kode Tiket / Nama / No. Antrian..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none text-sm transition-shadow bg-white"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsManualEntryOpen(true)}
              className="flex-1 sm:flex-none text-sm font-bold px-4 py-2 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-900 transition-colors shadow-sm focus:ring-2 focus:ring-[#fb9418]"
            >
              + Tambah Manual
            </button>
            <button
              onClick={loadVisitors}
              disabled={isLoading}
              className="flex-1 sm:flex-none text-sm font-bold px-4 py-2 bg-white border border-gray-300 rounded-lg text-black hover:bg-gray-50 transition-colors shadow-sm"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {visitors.length === 0 && !isLoading ? (
        <div className="flex-1 bg-white border border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center justify-center shadow-sm">
          <p className="text-gray-400 font-medium">Semua transaksi telah dikonfirmasi.</p>
        </div>
      ) : filteredVisitors.length === 0 && !isLoading ? (
        <div className="flex-1 bg-white border border-dashed border-gray-300 rounded-2xl p-12 flex items-center justify-center shadow-sm">
          <p className="text-gray-500 text-center">
            Tiket <span className="font-bold text-black">&ldquo;{searchQuery}&rdquo;</span> tidak ditemukan.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-12">
          {filteredVisitors.map((visitor) => (
            <VisitorCard
              key={visitor.id}
              visitor={visitor}
              isProcessing={processingId === visitor.id}
              canConfirm={canConfirm}
              onConfirmPayment={handlePaymentConfirmation}
              onEdit={handleEditClick}
            />
          ))}
        </div>
      )}

      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        transaction={selectedVisitor}
        onSave={handleSaveEdit}
        onDelete={handleDeleteTransaction}
        canDelete={canDelete}
      />
      <ManualEntryModal
        isOpen={isManualEntryOpen}
        onClose={() => setIsManualEntryOpen(false)}
        onSuccess={handleManualEntrySuccess}
        sessionId={sessionId}
      />
      <SuccessQueueModal isOpen={successTransaction !== null} transaction={successTransaction} onClose={handleCloseSuccessModal} />
    </div>
  );
};

export default AdminDashboard;
