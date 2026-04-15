import React, { useMemo } from 'react';

// Menyesuaikan interface agar menerima array transaksi untuk menghitung data per lantai
export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
}

export interface Transaction {
  items: TransactionItem[];
  // ... field lainnya jika perlu
}

interface SummaryProps {
  totalVisitors: number;
  totalChildren: number;
  totalTeens: number;
  totalAdults: number;
  totalRevenue: number;
  transactions: Transaction[]; // Menambahkan data transaksi untuk kalkulasi lantai
}

const Summary: React.FC<SummaryProps> = ({
  totalVisitors,
  totalChildren,
  totalTeens,
  totalAdults,
  totalRevenue,
  transactions,
}) => {
  
  // Kalkulasi jumlah pengunjung per lantai secara unik
  const floorStats = useMemo(() => {
    const stats: Record<string, number> = {};

    transactions.forEach((tx) => {
      // Kelompokkan item berdasarkan lantai dalam satu transaksi
      const floorsInTx = new Set<string>();
      tx.items.forEach(item => floorsInTx.add(item.floor));

      floorsInTx.forEach(floorName => {
        // Hitung total orang (bukan tiket) yang mengakses lantai ini
        // Kita ambil quantity dari kategori pertama yang ditemukan di lantai tersebut
        const peopleInFloor = tx.items
          .filter(item => item.floor === floorName)
          .reduce((sum, item, idx, arr) => {
             // Karena jumlah orang tiap kategori sama antar lantai, 
             // kita hanya menjumlahkan quantity unik per kategori usia
             const firstOfCategory = arr.findIndex(i => i.age_category === item.age_category) === idx;
             return firstOfCategory ? sum + item.quantity : sum;
          }, 0);

        stats[floorName] = (stats[floorName] || 0) + peopleInFloor;
      });
    });

    return Object.entries(stats).sort(); // Urutkan berdasarkan nama lantai
  }, [transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6 mb-6">
      {/* Grid Utama Stats */}
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

      {/* Bagian Summary Per Lantai */}
<div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h4 className="text-sm font-bold text-center text-gray-400 uppercase tracking-wider mb-6">
          Pengunjung Per Lantai
        </h4>
        
        {/* Menggunakan flex dan justify-center agar box tersusun ke tengah */}
        <div className="flex flex-wrap justify-center gap-4">
          {floorStats.length > 0 ? (
            floorStats.map(([floor, count]) => (
              <div 
                key={floor} 
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 min-w-[160px] sm:min-w-[200px]"
              >
                <span className="text-lg font-semibold text-gray-600 mr-4">{floor}</span>
                <span className="text-lg font-black text-blue-700">
                  {count} <small className="text-[10px] font-normal text-gray-400">Orang</small>
                </span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 italic text-sm">Belum ada data lantai.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Summary;