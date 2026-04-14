/**
 * PaymentHistoryComponent.tsx
 * ----------------------------------------------------
 * Reusable table component to display a list of transactions.
 * Designed to match the styling of the AdminDashboard cards.
 */

import React from "react";
import { formatCurrency, PRICES } from "../utils/priceCalculator"; // Assuming this exists based on your example

export interface Transaction {
  id: string;
  queue_number: number;
  created_at: string;
  under_8_count: number;
  under_22_count: number;
  adult_count: number;
  total_price: number;
  status: "pending" | "paid" | "cancelled";
}

interface PaymentHistoryComponentProps {
  transactions: Transaction[];
  isLoading: boolean;
  onEditClick: (transaction: Transaction) => void; // DITAMBAHKAN: Props untuk fungsi Edit
}

const PaymentHistoryComponent: React.FC<PaymentHistoryComponentProps> = ({
  transactions,
  isLoading,
  onEditClick, // DITAMBAHKAN: Destrukturisasi props
}) => {
  // Helper to format date consistently
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-lg">Mengambil data riwayat transaksi...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 text-center">
        <p className="text-gray-500 text-lg">Tidak ada transaksi yang ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white text-sm font-medium uppercase tracking-wider">
              <th className="p-4 rounded-tl-lg">No. Antrian</th>
              <th className="p-4">Tanggal & Waktu</th>
              <th className="p-4">Rincian Tiket</th>
              <th className="p-4">Total</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 rounded-tr-lg text-center">Aksi</th> {/* DITAMBAHKAN: Header Kolom Aksi */}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-bold text-gray-900 text-lg">
                  #{tx.queue_number}
                  <div className="text-xs font-normal text-gray-400 font-mono mt-1">
                    {tx.id.substring(0, 8)}...
                  </div>
                </td>
                <td className="p-4 text-sm text-gray-700">
                  {formatDateTime(tx.created_at)}
                </td>
                <td className="p-4 text-sm text-gray-600 space-y-1">
                  {tx.under_8_count > 0 && <div>Anak: {tx.under_8_count}</div>}
                  {tx.under_22_count > 0 && <div>Remaja: {tx.under_22_count}</div>}
                  {tx.adult_count > 0 && <div>Dewasa: {tx.adult_count}</div>}
                </td>
                <td className="p-4 text-base font-bold text-blue-700">
                  {formatCurrency(tx.total_price)}
                </td>
                <td className="p-4 text-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                      tx.status === "paid"
                        ? "bg-green-100 text-green-700 border border-green-200"
                        : tx.status === "pending"
                        ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                    }`}
                  >
                    {tx.status === "paid" ? "LUNAS" : tx.status === "pending" ? "PENDING" : "BATAL"}
                  </span>
                </td>
                {/* DITAMBAHKAN: Sel Tabel untuk Tombol Edit */}
                <td className="p-4 text-center">
                  <button
                    onClick={() => onEditClick(tx)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentHistoryComponent;