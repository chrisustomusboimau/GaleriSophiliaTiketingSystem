/**
 * Summary.tsx
 * ----------------------------------------------------
 * Komponen untuk menampilkan ringkasan data transaksi.
 * Diperbarui dengan identitas visual Galeria Sophilia (Putih/Hitam/Oranye) 
 * khusus untuk penggunaan Dashboard Admin/Kasir.
 */

import React, { useMemo, useState } from 'react';

// --- INTERFACES ---
export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
}

export interface TransactionOrigin {
  country_code: string;
  count: number;
}

export interface Transaction {
  items: TransactionItem[];
  origins?: TransactionOrigin[]; 
}

interface SummaryProps {
  totalVisitors: number;
  totalChildren: number;
  totalTeens: number;
  totalAdults: number;
  totalRevenue: number;
  transactions: Transaction[];
}

const Summary: React.FC<SummaryProps> = ({
  totalVisitors,
  totalChildren,
  totalTeens,
  totalAdults,
  totalRevenue,
  transactions,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // 1. Kalkulasi jumlah pengunjung per lantai
  const floorStats = useMemo(() => {
    const stats: Record<string, number> = {};

    transactions.forEach((tx) => {
      const floorsInTx = new Set<string>();
      tx.items.forEach(item => floorsInTx.add(item.floor));

      floorsInTx.forEach(floorName => {
        const peopleInFloor = tx.items
          .filter(item => item.floor === floorName)
          .reduce((sum, item, idx, arr) => {
             const firstOfCategory = arr.findIndex(i => i.age_category === item.age_category) === idx;
             return firstOfCategory ? sum + item.quantity : sum;
          }, 0);

        stats[floorName] = (stats[floorName] || 0) + peopleInFloor;
      });
    });

    return Object.entries(stats).sort(); 
  }, [transactions]);

  // 2. Kalkulasi jumlah pengunjung per negara
  const countryStats = useMemo(() => {
    const stats: Record<string, number> = {};

    transactions.forEach((tx) => {
      if (tx.origins) {
        tx.origins.forEach(origin => {
          const code = origin.country_code.toUpperCase();
          stats[code] = (stats[code] || 0) + origin.count;
        });
      }
    });

    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="mb-8">
      {/* Tombol Toggle Dropdown (Aksen Hitam/Oranye) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-5 rounded-2xl shadow-sm border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#fb9418] ${
          isExpanded 
            ? 'bg-black text-[#fcfcfc] border-black' 
            : 'bg-[#fcfcfc] text-black border-gray-200 hover:border-[#fb9418]'
        }`}
      >
        <span className="font-extrabold text-lg uppercase tracking-wider">Ringkasan Data Kasir</span>
        <svg
          className={`w-6 h-6 transform transition-transform duration-300 ${
            isExpanded ? 'rotate-180 text-[#fb9418]' : 'text-gray-400'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Konten Summary (Hanya tampil jika isExpanded == true) */}
      <div 
        className={`transition-all duration-500 ease-in-out overflow-hidden ${
          isExpanded ? 'opacity-100 mt-5 max-h-[2000px]' : 'opacity-0 max-h-0'
        }`}
      >
        <div className="space-y-6">
          
          {/* Grid Utama Stats (Total, Umur, Revenue) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Total Visitors (Highlight Hitam) */}
            <div className="bg-black p-5 rounded-2xl shadow-md border border-gray-800 flex flex-col justify-center items-center text-center">
              <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Orang</span>
              <span className="text-4xl font-black text-[#fb9418]">{totalVisitors}</span>
            </div>

            {/* Anak, Remaja, Dewasa (Background Putih) */}
            <div className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center text-center">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Anak</span>
              <span className="text-3xl font-black text-black">{totalChildren}</span>
            </div>

            <div className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center text-center">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Remaja</span>
              <span className="text-3xl font-black text-black">{totalTeens}</span>
            </div>

            <div className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center text-center">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Dewasa</span>
              <span className="text-3xl font-black text-black">{totalAdults}</span>
            </div>

            {/* Total Revenue (Highlight Oranye) */}
            <div className="bg-orange-50 p-5 rounded-2xl shadow-sm border border-[#fb9418]/30 flex flex-col justify-center items-center text-center">
              <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1">Pendapatan</span>
              <span className="text-2xl font-black text-[#fb9418]">{formatCurrency(totalRevenue)}</span>
            </div>

          </div>

          {/* Baris Bawah: Summary Per Lantai & Summary Per Negara */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Bagian Summary Per Lantai */}
            <div className="bg-[#fcfcfc] p-6 rounded-2xl shadow-sm border border-gray-200">
              <h4 className="text-sm font-extrabold text-black uppercase tracking-wider mb-5 border-b-2 border-gray-100 pb-3">
                Kunjungan Per Lantai
              </h4>
              
              <div className="flex flex-col gap-3">
                {floorStats.length > 0 ? (
                  floorStats.map(([floor, count]) => (
                    <div 
                      key={floor} 
                      className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm w-full"
                    >
                      <span className="text-sm font-bold text-gray-700 uppercase">{floor}</span>
                      <span className="text-xl font-black text-black">
                        {count} <small className="text-[10px] font-bold text-[#fb9418] uppercase tracking-widest ml-1">Orang</small>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg">Belum ada data lantai.</p>
                )}
              </div>
            </div>

            {/* Bagian Summary Per Negara */}
            <div className="bg-[#fcfcfc] p-6 rounded-2xl shadow-sm border border-gray-200">
              <h4 className="text-sm font-extrabold text-black uppercase tracking-wider mb-5 border-b-2 border-gray-100 pb-3">
                Distribusi Negara
              </h4>
              
              {/* Diubah jadi grid agar seragam dan rapi (mirip struk data) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {countryStats.length > 0 ? (
                  countryStats.map(([country, count]) => (
                    <div 
                      key={country} 
                      className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
                    >
                      <span className="text-2xl font-black text-black leading-none mb-1">{count}</span>
                      <span className="text-xs font-bold text-[#fb9418] uppercase tracking-widest">{country}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic text-sm col-span-full text-center py-4 bg-gray-50 rounded-lg">Belum ada data negara.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Summary;