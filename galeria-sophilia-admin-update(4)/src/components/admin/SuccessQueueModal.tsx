/**
 * SuccessQueueModal.tsx
 * ----------------------------------------------------
 * Modal notifikasi sukses setelah transaksi manual dibuat.
 * UPDATE: sistem baru menjadikan `ticket_code` (format 0808-001)
 * sebagai identitas utama tiket, nomor antrian tetap ditampilkan
 * sebagai info sekunder.
 */

import React from "react";
import { TransactionEntry } from "../../types";

interface SuccessQueueModalProps {
  isOpen: boolean;
  transaction: TransactionEntry | null;
  onClose: () => void;
}

const SuccessQueueModal: React.FC<SuccessQueueModalProps> = ({ isOpen, transaction, onClose }) => {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#fcfcfc] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
        <div className="bg-black border-b-4 border-[#fb9418] p-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-16 h-16 bg-[#fb9418]/10 text-[#fb9418] border border-[#fb9418]/40 rounded-full flex items-center justify-center mb-2 shadow-inner">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h4 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Tiket Dibuat!</h4>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Kode Tiket</p>
          <div className="text-4xl sm:text-5xl leading-none font-black text-[#fb9418] py-2 tracking-widest">
            {transaction.ticket_code}
          </div>
          <p className="text-gray-400 text-xs font-mono">Antrian ke-{transaction.queue_number} hari ini</p>
        </div>

        <div className="p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-4 text-base font-bold text-[#fcfcfc] bg-[#fb9418] hover:bg-orange-500 rounded-xl shadow-md transition-all active:scale-95"
          >
            Selesai &amp; Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessQueueModal;
