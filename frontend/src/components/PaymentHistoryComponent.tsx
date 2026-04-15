/**
 * PaymentHistoryComponent.tsx
 * ----------------------------------------------------
 * Reusable table component to display a list of transactions.
 * Designed to match the styling of the AdminDashboard cards.
 * Updated to support dynamic item arrays, showing unique people
 * counts per age category and their selected floors in separate columns.
 */

import React from "react";
import { formatCurrency } from "../utils/priceCalculator"; 

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price: number;
}

export interface Transaction {
  id: string;
  queue_number: number;
  created_at: string;
  total_price: number;
  status: "pending" | "paid" | "cancelled";
  items: TransactionItem[]; 
}

interface PaymentHistoryComponentProps {
  transactions: Transaction[];
  isLoading: boolean;
  onEditClick: (transaction: Transaction) => void; 
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

const PaymentHistoryComponent: React.FC<PaymentHistoryComponentProps> = ({
  transactions,
  isLoading,
  onEditClick,
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

  // Helper untuk menerjemahkan kategori ke Bahasa Indonesia
  const getCategoryLabel = (cat: string) => {
    if (cat === "adult") return "Dewasa";
    if (cat === "student") return "Remaja";
    if (cat === "child") return "Anak";
    return cat;
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
              <th className="p-4">Kategori Usia</th> {/* KOLOM DIPISAH 1 */}
              <th className="p-4">Lantai</th>        {/* KOLOM DIPISAH 2 */}
              <th className="p-4">Total</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 rounded-tr-lg text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => {
              
              // GROUPING LOGIC: Extract unique people count & their selected floors
              const groupedByCategory = tx.items.reduce((acc, item) => {
                const cat = item.age_category.toLowerCase();
                if (!acc[cat]) {
                  acc[cat] = { quantity: item.quantity, floors: new Set<string>() };
                }
                // Menggunakan Set agar nama lantai tidak duplikat jika terhitung berulang
                acc[cat].floors.add(item.floor);
                return acc;
              }, {} as Record<string, { quantity: number; floors: Set<string> }>);

              // Buat array gabungan semua lantai unik untuk transaksi ini
              const allUniqueFloors = Array.from(
                new Set(tx.items.map((item) => item.floor))
              ).sort(); // Sortir agar urut (misal: Floor 1, Floor 5)

              return (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-900 text-lg align-top">
                    #{tx.queue_number}
                    <div className="text-xs font-normal text-gray-400 font-mono mt-1">
                      {tx.id.substring(0, 8)}...
                    </div>
                  </td>
                  
                  <td className="p-4 text-sm text-gray-700 align-top">
                    {formatDateTime(tx.created_at)}
                  </td>
                  
                  {/* KOLOM 1: KATEGORI USIA & JUMLAH ORANG */}
                  <td className="p-4 align-top">
                    <div className="space-y-1.5">
                      {Object.keys(groupedByCategory).length > 0 ? (
                        Object.entries(groupedByCategory).map(([cat, data]) => (
                          <div key={cat} className="flex items-center text-sm">
                            <span className="font-medium text-gray-700 w-16">
                              {getCategoryLabel(cat)}
                            </span>
                            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded ml-2">
                              {data.quantity}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">Tidak ada</span>
                      )}
                    </div>
                  </td>

                  {/* KOLOM 2: LANTAI YANG DIPILIH */}
                  <td className="p-4 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {allUniqueFloors.length > 0 ? (
                        allUniqueFloors.map((floor, idx) => (
                          <span 
                            key={idx} 
                            className="text-[12px] font-medium bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-md"
                          >
                            {floor}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400 italic">-</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-4 text-base font-bold text-blue-700 align-top">
                    {formatCurrency(tx.total_price)}
                  </td>
                  
                  <td className="p-4 text-center align-top">
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
                  
                  <td className="p-4 text-center align-top">
                    <button
                      onClick={() => onEditClick(tx)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentHistoryComponent;