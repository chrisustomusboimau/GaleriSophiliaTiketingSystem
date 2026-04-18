/**
 * PaymentHistoryComponent.tsx
 * ----------------------------------------------------
 * Reusable table component to display a list of transactions.
 * Diperbarui dengan warna Galeria Sophilia (Hitam/Oranye) dan dukungan confirmed_at.
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

export interface TransactionOrigin {
  country_code: string;
  count: number;
}

export interface Transaction {
  id: string;
  queue_number: number;
  created_at: string;
  confirmed_at: string | null; // <-- DITAMBAHKAN
  total_price: number;
  status: "pending" | "paid" | "cancelled" | "confirmed"; // Diselaraskan dengan API
  items: TransactionItem[]; 
  origins?: TransactionOrigin[]; 
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
      <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-gray-500 font-medium">Mengambil data riwayat transaksi...</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-gray-500 font-medium">Tidak ada transaksi yang ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {/* Tema Galeria Sophilia pada Header Tabel */}
            <tr className="bg-black text-[#fcfcfc] text-xs font-bold uppercase tracking-widest border-b-4 border-[#fb9418]">
              <th className="p-4 rounded-tl-lg whitespace-nowrap">No. Antrian</th>
              <th className="p-4 whitespace-nowrap">Waktu Transaksi</th>
              <th className="p-4 whitespace-nowrap">Kategori Usia</th> 
              <th className="p-4 whitespace-nowrap">Asal Negara</th>
              <th className="p-4 whitespace-nowrap">Lantai</th>        
              <th className="p-4 whitespace-nowrap">Total</th>
              <th className="p-4 text-center whitespace-nowrap">Status</th>
              <th className="p-4 rounded-tr-lg text-center whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {transactions.map((tx) => {
              
              // GROUPING LOGIC
              const groupedByCategory = tx.items.reduce((acc, item) => {
                const cat = item.age_category.toLowerCase();
                if (!acc[cat]) {
                  acc[cat] = { quantity: item.quantity, floors: new Set<string>() };
                }
                acc[cat].floors.add(item.floor);
                return acc;
              }, {} as Record<string, { quantity: number; floors: Set<string> }>);

              const allUniqueFloors = Array.from(
                new Set(tx.items.map((item) => item.floor))
              ).sort(); 

              return (
                <tr key={tx.id} className="hover:bg-orange-50/50 transition-colors">
                  
                  {/* KOLOM: ANTRIAN */}
                  <td className="p-4 align-top">
                    <div className="font-extrabold text-black text-lg">#{tx.queue_number}</div>
                    <div className="text-[10px] font-medium text-gray-400 font-mono mt-1 uppercase tracking-wider">
                      {tx.id.substring(0, 8)}...
                    </div>
                  </td>
                  
                  {/* KOLOM: WAKTU TRANSAKSI (CREATED & CONFIRMED) */}
                  <td className="p-4 text-gray-700 align-top">
                    <div className="space-y-2">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Dibuat</span>
                        <span className="font-medium">{formatDateTime(tx.created_at)}</span>
                      </div>
                      
                      {/* Logika Tampilan Waktu Konfirmasi */}
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Dikonfirmasi</span>
                        {tx.confirmed_at ? (
                           <span className="font-bold text-green-700">{formatDateTime(tx.confirmed_at)}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded uppercase">
                            Belum Lunas
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* KOLOM: KATEGORI USIA */}
                  <td className="p-4 align-top">
                    <div className="space-y-1.5">
                      {Object.keys(groupedByCategory).length > 0 ? (
                        Object.entries(groupedByCategory).map(([cat, data]) => (
                          <div key={cat} className="flex items-center">
                            <span className="font-medium text-gray-700 w-16">
                              {getCategoryLabel(cat)}
                            </span>
                            {/* Menggunakan aksen oranye */}
                            <span className="font-bold text-[#fb9418] bg-orange-50 border border-orange-100 px-2 py-0.5 rounded ml-2">
                              {data.quantity}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">Tidak ada</span>
                      )}
                    </div>
                  </td>

                  {/* KOLOM: ASAL NEGARA */}
                  <td className="p-4 align-top">
                    <div className="space-y-1.5">
                      {tx.origins && tx.origins.length > 0 ? (
                        tx.origins.map((origin, idx) => (
                          <div key={idx} className="flex items-center">
                            <span className="font-medium text-gray-700 w-10 uppercase">
                              {origin.country_code}
                            </span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded ml-2">
                              {origin.count}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </div>
                  </td>

                  {/* KOLOM: LANTAI */}
                  <td className="p-4 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {allUniqueFloors.length > 0 ? (
                        allUniqueFloors.map((floor, idx) => (
                          <span 
                            key={idx} 
                            className="text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200 px-2 py-1 rounded-md uppercase tracking-wider"
                          >
                            {floor}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </div>
                  </td>
                  
                  {/* KOLOM: TOTAL */}
                  <td className="p-4 text-base font-black text-black align-top">
                    {formatCurrency(tx.total_price)}
                  </td>
                  
                  {/* KOLOM: STATUS */}
                  <td className="p-4 text-center align-top">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-extrabold shadow-sm uppercase tracking-wider ${
                        tx.status === "paid" || tx.status === "confirmed"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : tx.status === "pending"
                          ? "bg-yellow-100 text-yellow-700 border border-yellow-200"
                          : "bg-red-100 text-red-700 border border-red-200"
                      }`}
                    >
                      {tx.status === "paid" || tx.status === "confirmed" ? "LUNAS" : tx.status === "pending" ? "PENDING" : "BATAL"}
                    </span>
                  </td>
                  
                  {/* KOLOM: AKSI */}
                  <td className="p-4 text-center align-top">
                    <button
                      onClick={() => onEditClick(tx)}
                      // Menggunakan aksen oranye saat hover
                      className="text-xs font-bold text-gray-500 hover:text-[#fcfcfc] hover:bg-black px-3 py-1.5 rounded-lg border border-gray-300 hover:border-black transition-all focus:outline-none focus:ring-2 focus:ring-black"
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