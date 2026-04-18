/**
 * PaymentHistoryComponent.tsx
 * ----------------------------------------------------
 * Reusable table component to display a list of transactions.
 * Diperbarui dengan warna Galeria Sophilia (Hitam/Oranye) dan dukungan confirmed_at.
 * Update: Menerapkan Tema Warna Lantai yang konsisten dengan AdminDashboard.
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
  confirmed_at: string | null; 
  total_price: number;
  status: "pending" | "paid" | "cancelled" | "confirmed"; 
  payment_method: string;
  items: TransactionItem[]; 
  origins?: TransactionOrigin[]; 
}

interface PaymentHistoryComponentProps {
  transactions: Transaction[];
  isLoading: boolean;
  onEditClick: (transaction: Transaction) => void; 
}

/* =====================================================
   HELPERS (THEMING)
===================================================== */

// Fungsi untuk menentukan warna latar dan teks spesifik tiap lantai
// 100% KONSISTEN dengan AdminDashboard.tsx
const getFloorColorTheme = (floorName: string) => {
  const name = floorName.toLowerCase();
  
  if (name.includes("1")) {
    return "bg-blue-100 text-blue-800 border-blue-200";
  }
  if (name.includes("5")) {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (name.includes("6") || name.includes("7")) {
    return "bg-purple-100 text-purple-800 border-purple-200";
  }
  
  // Default jika lantai tidak dikenali
  return "bg-gray-100 text-gray-800 border-gray-200";
};


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
              <th className="p-4 whitespace-nowrap">Pembayaran</th>
              <th className="p-4 whitespace-nowrap">Total Tagihan</th>
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
                } else {
                  // Tambahkan quantity jika kategori yang sama muncul lagi (karena beda lantai)
                  acc[cat].quantity += item.quantity;
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
                        <span className="font-medium whitespace-nowrap">{formatDateTime(tx.created_at)}</span>
                      </div>
                      
                      {/* Logika Tampilan Waktu Konfirmasi */}
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Dikonfirmasi</span>
                        {tx.confirmed_at ? (
                           <span className="font-bold text-green-700 whitespace-nowrap">{formatDateTime(tx.confirmed_at)}</span>
                        ) : (
                          <span className="text-[11px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded uppercase whitespace-nowrap">
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

                  {/* KOLOM: LANTAI (DENGAN TEMA WARNA) */}
                  <td className="p-4 align-top">
                    <div className="flex flex-col gap-1.5">
                      {allUniqueFloors.length > 0 ? (
                        allUniqueFloors.map((floor, idx) => {
                          const themeClass = getFloorColorTheme(floor);
                          return (
                            <span 
                              key={idx} 
                              className={`text-[11px] font-bold border px-2 py-1 rounded-md uppercase tracking-wider whitespace-nowrap text-center ${themeClass}`}
                            >
                              {floor}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-gray-400 italic">-</span>
                      )}
                    </div>
                  </td>

                  {/* KOLOM: JENIS PEMBAYARAN */}
                  <td className="p-4 align-top">
                    <div className="mt-0.5">
                      {tx.payment_method === "card" ? (
                        <span className="inline-flex items-center justify-center w-full gap-1.5 text-[10px] font-bold px-2 py-1.5 bg-gray-800 text-white border border-gray-700 rounded-md uppercase tracking-wider shadow-sm">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                          KARTU
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-full gap-1.5 text-[10px] font-bold px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md uppercase tracking-wider shadow-sm">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                          QRIS
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* KOLOM: TOTAL */}
                  <td className="p-4 text-base font-black text-black align-top whitespace-nowrap">
                    <span className="text-xs text-gray-500 font-bold mr-1">IDR</span>
                    {formatCurrency(tx.total_price).replace('Rp', '').trim()}
                  </td>
                  
                  {/* KOLOM: STATUS */}
                  <td className="p-4 text-center align-top">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-extrabold shadow-sm uppercase tracking-wider mt-1 ${
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
                      className="mt-0.5 text-xs font-bold text-gray-500 hover:text-[#fcfcfc] hover:bg-black px-3 py-1.5 rounded-lg border border-gray-300 hover:border-black transition-all focus:outline-none focus:ring-2 focus:ring-black w-full"
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