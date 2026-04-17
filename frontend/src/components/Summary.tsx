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
  origins?: TransactionOrigin[]; // Ditambahkan untuk kalkulasi negara
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
  // State untuk kontrol dropdown (buka/tutup summary)
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
          // Ubah kode negara jadi huruf besar agar rapi di UI (misal: "id" -> "ID")
          const code = origin.country_code.toUpperCase();
          stats[code] = (stats[code] || 0) + origin.count;
        });
      }
    });

    // Urutkan dari jumlah pengunjung terbanyak ke terdikit
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
    <div className="mb-6">
      {/* Tombol Toggle Dropdown */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="font-bold text-gray-800 text-lg">Ringkasan Data</span>
        <svg
          className={`w-6 h-6 text-gray-500 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Konten Summary (Hanya tampil jika isExpanded == true) */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'opacity-100 mt-4 max-h-[2000px]' : 'opacity-0 max-h-0'
        }`}
      >
        <div className="space-y-6">
          
          {/* Grid Utama Stats (Total, Umur, Revenue) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium mb-1">Total Visitors</span>
              <span className="text-3xl font-bold text-gray-800">{totalVisitors}</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium mb-1">Children</span>
              <span className="text-3xl font-bold text-blue-600">{totalChildren}</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium mb-1">Teens</span>
              <span className="text-3xl font-bold text-indigo-600">{totalTeens}</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium mb-1">Adults</span>
              <span className="text-3xl font-bold text-purple-600">{totalAdults}</span>
            </div>

            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
              <span className="text-sm text-gray-500 font-medium mb-1">Total Revenue</span>
              <span className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</span>
            </div>
          </div>

          {/* Baris Bawah: Summary Per Lantai & Summary Per Negara */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Bagian Summary Per Lantai */}
<div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-sm font-bold text-center text-gray-400 uppercase tracking-wider mb-6">
                Pengunjung Per Lantai
              </h4>
              
              {/* UBAH: Menggunakan flex-col agar tersusun vertikal ke bawah */}
              <div className="flex flex-col gap-3">
                {floorStats.length > 0 ? (
                  floorStats.map(([floor, count]) => (
                    <div 
                      key={floor} 
                      // UBAH: Menghapus flex-1 dan min-w, tambahkan w-full
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 w-full"
                    >
                      <span className="text-base font-semibold text-gray-600">{floor}</span>
                      <span className="text-lg font-black text-blue-700">
                        {count} <small className="text-[10px] font-normal text-gray-400">Orang</small>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic text-sm text-center">Belum ada data lantai.</p>
                )}
              </div>
            </div>

            {/* Bagian Summary Per Negara */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h4 className="text-sm font-bold text-center text-gray-400 uppercase tracking-wider mb-6">
                Pengunjung Per Negara
              </h4>
              <div className="flex flex-wrap justify-center gap-4">
                {countryStats.length > 0 ? (
                  countryStats.map(([country, count]) => (
                    <div 
                      key={country} 
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 min-w-[100px] sm:min-w-[140px] flex-1"
                    >
                      <span className="text-base font-bold text-gray-700 mr-2">{country}</span>
                      <span className="text-lg font-black text-emerald-600">
                        {count} <small className="text-[10px] font-normal text-gray-400">Orang</small>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 italic text-sm">Belum ada data negara.</p>
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