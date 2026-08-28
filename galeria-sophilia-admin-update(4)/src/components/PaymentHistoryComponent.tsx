/**
 * src/components/PaymentHistoryComponent.tsx
 * ----------------------------------------------------
 * Tabel riwayat transaksi. Dibuat ulang sepenuhnya untuk skema baru:
 * tidak ada lagi kolom "floor / age_category" tetap — rincian tiket
 * sekarang ditampilkan dari `ticket_name_snapshot` per item, dan kolom
 * baru `customer_name` ditambahkan sebagai identitas pemesan.
 */

import React from "react";
import { TransactionEntry } from "../types";
import {
  formatCurrency,
  formatDateTimeID,
  formatTimeID,
  PAYMENT_METHOD_LABEL,
  TRANSACTION_STATUS_LABEL,
} from "../utils/formatters";

export type Transaction = TransactionEntry;

interface PaymentHistoryComponentProps {
  transactions: TransactionEntry[];
  isLoading: boolean;
  onEditClick: (tx: TransactionEntry) => void;
  canEdit?: boolean;
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "confirmed":
    case "paid":
      return "bg-green-100 text-green-700 border-green-200";
    case "pending":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "cancelled":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const PaymentHistoryComponent: React.FC<PaymentHistoryComponentProps> = ({
  transactions,
  isLoading,
  onEditClick,
  canEdit = true,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center text-gray-400 font-medium">
        Memuat riwayat transaksi...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
        Tidak ada transaksi yang cocok dengan filter saat ini.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
          <tr>
            <th className="px-4 py-3 text-left">Kode Tiket</th>
            <th className="px-4 py-3 text-left">Pemesan</th>
            <th className="px-4 py-3 text-left">Tanggal &amp; Waktu</th>
            <th className="px-4 py-3 text-left">Rincian Tiket</th>
            <th className="px-4 py-3 text-left">Metode</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-t border-gray-100 hover:bg-gray-50/60 align-top">
              <td className="px-4 py-3">
                <span className="font-black text-black tracking-wide">{tx.ticket_code}</span>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">Ke-{tx.queue_number}</p>
              </td>
              <td className="px-4 py-3 text-gray-700 font-medium">{tx.customer_name || <span className="text-gray-300 italic">Tanpa nama</span>}</td>
              <td className="px-4 py-3 text-gray-600">
                <p>{formatDateTimeID(tx.created_at)}</p>
                {tx.confirmed_at && <p className="text-[10px] text-green-600 font-bold mt-0.5">Lunas {formatTimeID(tx.confirmed_at)}</p>}
              </td>
              <td className="px-4 py-3">
                <ul className="space-y-0.5">
                  {tx.items.map((item, idx) => (
                    <li key={idx} className="text-[12px] text-gray-700">
                      <span className="font-bold text-black">{item.quantity}x</span> {item.ticket_name_snapshot}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-3 text-gray-600 font-bold text-xs uppercase">{PAYMENT_METHOD_LABEL[tx.payment_method] || tx.payment_method}</td>
              <td className="px-4 py-3 text-right font-black text-black">{formatCurrency(tx.total_price)}</td>
              <td className="px-4 py-3">
                <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${statusBadgeClass(tx.status)}`}>
                  {TRANSACTION_STATUS_LABEL[tx.status] || tx.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {canEdit && (
                  <button
                    onClick={() => onEditClick(tx)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-[#fb9418] hover:text-[#fb9418] transition-colors"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PaymentHistoryComponent;
