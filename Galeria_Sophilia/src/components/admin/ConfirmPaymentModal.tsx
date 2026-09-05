/**
 * ConfirmPaymentModal.tsx (src/components/admin) — BARU
 * ----------------------------------------------------
 * Pop-up konfirmasi pembayaran di Antrian Kasir.
 *
 * KENAPA ADA: transaksi yang dipesan pengunjung sendiri lewat halaman
 * publik hanya membawa KATEGORI pembayaran (QRIS / EDC) — saat itu belum
 * ada kasir, jadi belum ada terminal. Detailnya baru bisa diketahui di
 * detik kasir benar-benar menagih. Di sinilah kasir memilih alat yang
 * dipakai ("EDC 2"), dan pilihan itu sekaligus menetapkan kategori
 * transaksi supaya keduanya tidak pernah bertentangan.
 *
 * Pilihan terminalnya TERBATAS pada terminal yang dipilih kasir saat
 * membuka sesi kasir (lihat `CashierSessionContext`) — kasir tidak bisa
 * menagih lewat EDC yang bukan di mejanya.
 */

import React, { useEffect, useState } from "react";
import { PaymentTerminal, TransactionEntry } from "../../types";
import { formatCurrency, PAYMENT_METHOD_LABEL } from "../../utils/formatters";
import TerminalPicker, { CASH_SELECTION, PaymentSelection, selectionFromTransaction } from "./TerminalPicker";

interface ConfirmPaymentModalProps {
  isOpen: boolean;
  transaction: TransactionEntry | null;
  terminals: PaymentTerminal[];
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: (transactionId: string, selection: PaymentSelection) => Promise<void>;
}

const ConfirmPaymentModal: React.FC<ConfirmPaymentModalProps> = ({
  isOpen,
  transaction,
  terminals,
  isProcessing,
  onClose,
  onConfirm,
}) => {
  const [selection, setSelection] = useState<PaymentSelection>(CASH_SELECTION);
  const [error, setError] = useState<string | null>(null);

  // Preseleksi cerdas: kalau pengunjung sudah menyatakan mau bayar QRIS,
  // sorot terminal QRIS pertama milik kasir ini. Kasir tetap bisa
  // menggantinya — pengunjung sering berubah pikiran di depan meja.
  useEffect(() => {
    if (!isOpen || !transaction) return;
    setError(null);

    if (transaction.payment_terminal_id) {
      setSelection(selectionFromTransaction(transaction.payment_terminal_id, transaction.payment_method));
      return;
    }
    const match = terminals.find((t) => t.category === transaction.payment_method);
    setSelection(match ? { terminalId: match.id, category: match.category } : CASH_SELECTION);
  }, [isOpen, transaction, terminals]);

  if (!isOpen || !transaction) return null;

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm(transaction.id, selection);
    } catch (err: any) {
      setError(err?.message || "Gagal mengonfirmasi pembayaran.");
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isProcessing) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
        <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Konfirmasi Pembayaran</h3>
            <p className="text-[11px] text-gray-400 font-mono mt-1">
              Kode: <span className="font-bold text-[#fb9418] text-sm">{transaction.ticket_code}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-white text-2xl font-bold px-2 transition-colors"
          >
            ✕
          </button>
        </header>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{error}</div>}

          {/* Ringkasan tagihan */}
          <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
            <div className="flex justify-between items-end">
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest block">Total Tagihan</span>
                <span className="text-sm font-medium text-gray-700 truncate block mt-0.5">
                  {transaction.customer_name || "Tanpa nama"}
                </span>
              </div>
              <span className="text-2xl font-black text-[#fb9418] shrink-0 ml-3">
                {formatCurrency(transaction.total_price)}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-orange-200">
              Pilihan pengunjung saat memesan:{" "}
              <strong className="text-black">{PAYMENT_METHOD_LABEL[transaction.payment_method] || transaction.payment_method}</strong>
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
              Terminal yang Dipakai Menagih
            </label>
            <p className="text-[11px] text-gray-400 mb-3">
              Pilihan ini tercatat sebagai <strong>Metode Pembayaran Detail</strong> di riwayat transaksi, dan
              menentukan kategorinya.
            </p>
            <TerminalPicker
              terminals={terminals}
              value={selection}
              onChange={setSelection}
              disabled={isProcessing}
              name="confirm-payment-terminal"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0 bg-white">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-black font-bold rounded-lg transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-6 py-2.5 bg-[#fb9418] text-[#fcfcfc] hover:bg-orange-500 font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 min-w-[150px]"
          >
            {isProcessing ? "Memproses..." : "Konfirmasi Lunas"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmPaymentModal;
