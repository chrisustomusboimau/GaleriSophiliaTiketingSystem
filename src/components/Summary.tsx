/**
 * Summary.tsx
 * ----------------------------------------------------
 * Komponen untuk menampilkan ringkasan data transaksi.
 * Diperbarui dengan identitas visual Galeria Sophilia (Putih/Hitam/Oranye).
 * Update: Menambahkan Preset Tombol Sesi Waktu.
 */

import React, { useMemo, useState } from 'react';

// --- INTERFACES ---
export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price?: number;
}

export interface TransactionOrigin {
  country_code: string;
  count: number;
}

export interface Transaction {
  id?: string;
  queue_number: number;
  status: string;
  payment_method?: string;
  total_price?: number;
  created_at?: string; // Diperlukan untuk rekap waktu
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

// Konfigurasi Harga Dasar untuk Tabel Rekap
const TICKET_CATEGORIES = [
  { floor: "Floor 1", age: "adult", label: "Lantai 1 - Dewasa", price: 60000 },
  { floor: "Floor 1", age: "student", label: "Lantai 1 - Remaja", price: 40000 },
  { floor: "Floor 1", age: "child", label: "Lantai 1 - Anak", price: 20000 },
  { floor: "Floor 5", age: "adult", label: "Lantai 5 - Dewasa", price: 40000 },
  { floor: "Floor 5", age: "student", label: "Lantai 5 - Remaja", price: 20000 },
  { floor: "Floor 5", age: "child", label: "Lantai 5 - Anak", price: 10000 },
  { floor: "Floor 6/7", age: "adult", label: "Lantai 6 & 7 - Dewasa", price: 100000 },
  { floor: "Floor 6/7", age: "student", label: "Lantai 6 & 7 - Remaja", price: 50000 },
  { floor: "Floor 6/7", age: "child", label: "Lantai 6 & 7 - Anak", price: 25000 },
];

const Summary: React.FC<SummaryProps> = ({ transactions }) => {
  // STATE: Untuk Filter Rentang Waktu Global & Preset
  const [startTimeStr, setStartTimeStr] = useState<string>('00:00');
  const [endTimeStr, setEndTimeStr] = useState<string>('23:59');
  const [activeSession, setActiveSession] = useState<string>('manual');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // --- Handlers untuk Preset Sesi ---
  const handleSessionSelect = (sessionName: string, start: string, end: string) => {
    setActiveSession(sessionName);
    setStartTimeStr(start);
    setEndTimeStr(end);
  };

  const handleManualTimeChange = (type: 'start' | 'end', value: string) => {
    setActiveSession('manual'); // Otomatis pindah ke manual jika jam diubah sendiri
    if (type === 'start') setStartTimeStr(value);
    else setEndTimeStr(value);
  };

  // =========================================================
  // 0. PRE-FILTER TRANSAKSI BERDASARKAN WAKTU
  // =========================================================
  const filteredTransactions = useMemo(() => {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    if (isNaN(startH) || isNaN(endH)) return transactions;

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    // Pastikan urutan waktu benar
    const actualStart = Math.min(startMins, endMins);
    const actualEnd = Math.max(startMins, endMins);

    return transactions.filter(tx => {
      if (!tx.created_at) return true; // Jika tidak ada timestamp, ikutkan saja
      const date = new Date(tx.created_at);
      const txMins = date.getHours() * 60 + date.getMinutes();
      
      // Filter transaksi yang hanya berada di antara waktu yang dipilih
      return txMins >= actualStart && txMins <= actualEnd;
    });
  }, [transactions, startTimeStr, endTimeStr]);


  // =========================================================
  // KALKULASI DINAMIS (Menggunakan filteredTransactions)
  // =========================================================
  
  // 1. Kalkulasi Statistik Utama
  const dynamicStats = useMemo(() => {
    let visitors = 0, children = 0, teens = 0, adults = 0, revenue = 0;
    
    filteredTransactions.forEach(tx => {
      revenue += (tx.total_price || 0);
      
      const seenCategories = new Set<string>();
      tx.items.forEach(item => {
        const cat = item.age_category.toLowerCase();
        if (!seenCategories.has(cat)) {
          if (cat === 'child') children += item.quantity;
          else if (cat === 'student' || cat === 'teen') teens += item.quantity;
          else if (cat === 'adult') adults += item.quantity;
          seenCategories.add(cat);
        }
      });
    });

    visitors = children + teens + adults;
    return { visitors, children, teens, adults, revenue };
  }, [filteredTransactions]);

  // 2. Kalkulasi jumlah pengunjung per lantai
  const floorStats = useMemo(() => {
    const stats: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
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
  }, [filteredTransactions]);

  // 3. Kalkulasi jumlah pengunjung per negara
  const countryStats = useMemo(() => {
    const stats: Record<string, number> = {};

    filteredTransactions.forEach((tx) => {
      if (tx.origins) {
        tx.origins.forEach(origin => {
          const code = origin.country_code.toUpperCase();
          stats[code] = (stats[code] || 0) + origin.count;
        });
      }
    });

    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [filteredTransactions]);

  // 4. Kalkulasi Tabel Rekapitulasi Pembayaran (QRIS vs Card)
  const salesSummary = useMemo(() => {
    const rows = TICKET_CATEGORIES.map(cat => ({
      ...cat,
      qrisQty: 0,
      qrisNominal: 0,
      cardQty: 0,
      cardNominal: 0,
    }));

    const rowMap = new Map(rows.map(r => [`${r.floor}-${r.age}`, r]));

    let totalQrisQty = 0, totalQrisNominal = 0;
    let totalCardQty = 0, totalCardNominal = 0;

    filteredTransactions.forEach(tx => {
      const isCard = tx.payment_method === 'card';

      tx.items.forEach(item => {
        const key = `${item.floor}-${item.age_category.toLowerCase()}`;
        const row = rowMap.get(key);
        
        if (row && item.quantity > 0) {
          const nominal = item.quantity * row.price;

          if (isCard) {
            row.cardQty += item.quantity;
            row.cardNominal += nominal;
            totalCardQty += item.quantity;
            totalCardNominal += nominal;
          } else {
            // Default: QRIS
            row.qrisQty += item.quantity;
            row.qrisNominal += nominal;
            totalQrisQty += item.quantity;
            totalQrisNominal += nominal;
          }
        }
      });
    });

    return { 
      rows, 
      totals: { totalQrisQty, totalQrisNominal, totalCardQty, totalCardNominal } 
    };
  }, [filteredTransactions]);

  // =========================================================
  // 5. KALKULASI INTERVAL WAKTU 30 MENIT
  // =========================================================
  const timeIntervalStats = useMemo(() => {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);
    
    if (isNaN(startH) || isNaN(endH)) return [];

    let startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;
    
    if (startMins > endMins) {
      const temp = startMins;
      startMins = endMins;
      endMins = temp;
    }

    const intervals: {
      label: string;
      startMin: number;
      endMin: number;
      floor1: number;
      floor5: number;
      floor67: number;
      total: number;
    }[] = [];

    for (let m = startMins; m < endMins; m += 30) {
      const blockStartH = Math.floor(m / 60).toString().padStart(2, '0');
      const blockStartM = (m % 60).toString().padStart(2, '0');
      
      const nextM = Math.min(m + 30, endMins);
      const blockEndH = Math.floor(nextM / 60).toString().padStart(2, '0');
      const blockEndM = (nextM % 60).toString().padStart(2, '0');

      intervals.push({
        label: `${blockStartH}:${blockStartM} - ${blockEndH}:${blockEndM}`,
        startMin: m,
        endMin: nextM,
        floor1: 0,
        floor5: 0,
        floor67: 0,
        total: 0
      });
    }

    // Menggunakan filteredTransactions agar selaras
    filteredTransactions.forEach(tx => {
      if (!tx.created_at) return;
      
      const date = new Date(tx.created_at);
      const txMins = date.getHours() * 60 + date.getMinutes();

      const interval = intervals.find(inv => txMins >= inv.startMin && txMins < inv.endMin);
      if (!interval) return;

      let f1 = 0, f5 = 0, f67 = 0;
      const seenF1 = new Set(), seenF5 = new Set(), seenF67 = new Set();

      tx.items.forEach(item => {
        if (item.floor === 'Floor 1' && !seenF1.has(item.age_category)) { f1 += item.quantity; seenF1.add(item.age_category); }
        else if (item.floor === 'Floor 5' && !seenF5.has(item.age_category)) { f5 += item.quantity; seenF5.add(item.age_category); }
        else if (item.floor === 'Floor 6/7' && !seenF67.has(item.age_category)) { f67 += item.quantity; seenF67.add(item.age_category); }
      });

      interval.floor1 += f1;
      interval.floor5 += f5;
      interval.floor67 += f67;
      interval.total += (f1 + f5 + f67);
    });

    return intervals;

  }, [filteredTransactions, startTimeStr, endTimeStr]);


  return (
    <div className="mb-8">
      {/* Konten Summary Langsung Terbuka */}
      <div className="space-y-6">

        {/* =========================================================
            BARU: FILTER WAKTU GLOBAL & PRESET
            ========================================================= */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            
            {/* Bagian Kiri: Judul dan Preset Sesi */}
            <div className="flex-1">
              <h3 className="font-extrabold text-black uppercase tracking-wider text-sm mb-3">Filter Rentang Waktu</h3>
              
              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => handleSessionSelect('minggu_pagi', '09:00', '10:45')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    activeSession === 'minggu_pagi'
                      ? 'bg-black text-white border-black shadow-md'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Minggu Pagi (09.00 - 10.45)
                </button>
                <button
                  onClick={() => handleSessionSelect('minggu_siang', '12:00', '15:00')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    activeSession === 'minggu_siang'
                      ? 'bg-black text-white border-black shadow-md'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Minggu Siang (12.00 - 15.00)
                </button>
                <button
                  onClick={() => handleSessionSelect('sabtu', '13:30', '16:30')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    activeSession === 'sabtu'
                      ? 'bg-black text-white border-black shadow-md'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Sabtu (13.30 - 16.30)
                </button>
                <button
                  onClick={() => setActiveSession('manual')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                    activeSession === 'manual'
                      ? 'bg-orange-50 text-[#fb9418] border-orange-200'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Kustom Manual
                </button>
              </div>

              <p className="text-[11px] sm:text-xs text-gray-500 font-medium">
                Pilih sesi atau atur jam manual di samping untuk menampilkan rekapitulasi data penjualan dan statistik pada periode tertentu.
              </p>
            </div>
            
            {/* Bagian Kanan: Input Manual */}
            <div className="flex items-center gap-2 text-sm font-bold bg-gray-50 p-2 rounded-lg border border-gray-200 shrink-0">
              <input 
                type="time" 
                value={startTimeStr} 
                onChange={(e) => handleManualTimeChange('start', e.target.value)}
                className="bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-[#fb9418] focus:ring-1 focus:ring-[#fb9418] transition-all"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="time" 
                value={endTimeStr} 
                onChange={(e) => handleManualTimeChange('end', e.target.value)}
                className="bg-white border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-[#fb9418] focus:ring-1 focus:ring-[#fb9418] transition-all"
              />
            </div>

          </div>
        </div>
        
        {/* Grid Utama Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          <div className="bg-black p-5 rounded-2xl shadow-md border border-gray-800 flex flex-col justify-center items-center text-center">
            <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Orang</span>
            <span className="text-4xl font-black text-[#fb9418]">{dynamicStats.visitors}</span>
          </div>

          <div className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center text-center">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Dewasa</span>
            <span className="text-3xl font-black text-black">{dynamicStats.adults}</span>
          </div>

          <div className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center text-center">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Remaja</span>
            <span className="text-3xl font-black text-black">{dynamicStats.teens}</span>
          </div>

          <div className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center text-center">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">Anak</span>
            <span className="text-3xl font-black text-black">{dynamicStats.children}</span>
          </div>

          <div className="bg-orange-50 p-5 rounded-2xl shadow-sm border border-[#fb9418]/30 flex flex-col justify-center items-center text-center">
            <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1">Total Tagihan</span>
            <span className="text-2xl font-black text-[#fb9418]">{formatCurrency(dynamicStats.revenue)}</span>
          </div>

        </div>

        {/* TABEL REKAPITULASI PENJUALAN TIKET (QRIS VS CARD) */}
        <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="p-5 border-b border-gray-200 bg-white flex justify-between items-center">
            <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">
              Rekapitulasi Penjualan (Sesuai Filter Waktu)
            </h4>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-black text-[#fcfcfc] text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b border-zinc-800">
                  <th className="p-3 align-middle" rowSpan={2}>Jenis Tiket</th>
                  <th className="p-3 align-middle border-r border-zinc-800 text-center" rowSpan={2}>Harga</th>
                  <th className="p-3 text-center border-r border-zinc-800" colSpan={2}>QRIS</th>
                  <th className="p-3 text-center border-r border-zinc-800" colSpan={2}>CARD / EDC</th>
                  <th className="p-3 text-center" colSpan={2}>GRAND TOTAL (GT)</th>
                </tr>
                <tr className="bg-zinc-900 text-gray-300 text-[10px] font-bold uppercase tracking-widest border-b-2 border-[#fb9418]">
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-center border-r border-zinc-700">Rp</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-center border-r border-zinc-700">Rp</th>
                  <th className="p-2 text-center text-[#fb9418]">Qty</th>
                  <th className="p-2 text-center text-[#fb9418]">Rp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs sm:text-sm bg-white">
                {salesSummary.rows.map((row, idx) => {
                  const rowGtQty = row.qrisQty + row.cardQty;
                  const rowGtNominal = row.qrisNominal + row.cardNominal;
                  
                  return (
                    <tr key={idx} className="hover:bg-orange-50/40 transition-colors">
                      <td className="p-3 font-bold text-gray-800 whitespace-nowrap">{row.label}</td>
                      <td className="p-3 text-center font-mono text-gray-500 border-r border-gray-100 whitespace-nowrap">
                        {formatCurrency(row.price)}
                      </td>
                      
                      {/* QRIS */}
                      <td className={`p-3 text-center font-bold ${row.qrisQty > 0 ? 'text-black' : 'text-gray-300'}`}>
                        {row.qrisQty}
                      </td>
                      <td className={`p-3 text-right font-mono border-r border-gray-100 ${row.qrisNominal > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                        {row.qrisNominal > 0 ? formatCurrency(row.qrisNominal) : '-'}
                      </td>

                      {/* CARD / EDC */}
                      <td className={`p-3 text-center font-bold ${row.cardQty > 0 ? 'text-black' : 'text-gray-300'}`}>
                        {row.cardQty}
                      </td>
                      <td className={`p-3 text-right font-mono border-r border-gray-100 ${row.cardNominal > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                        {row.cardNominal > 0 ? formatCurrency(row.cardNominal) : '-'}
                      </td>

                      {/* GRAND TOTAL ROW */}
                      <td className={`p-3 text-center font-black ${rowGtQty > 0 ? 'text-black bg-orange-50/50' : 'text-gray-300'}`}>
                        {rowGtQty}
                      </td>
                      <td className={`p-3 text-right font-bold font-mono ${rowGtNominal > 0 ? 'text-[#fb9418] bg-orange-50/50' : 'text-gray-300'}`}>
                        {rowGtNominal > 0 ? formatCurrency(rowGtNominal) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* FOOTER TOTAL */}
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 text-xs sm:text-sm font-black">
                <tr>
                  <td className="p-3 text-right uppercase tracking-wider text-black" colSpan={2}>
                    Total Keseluruhan:
                  </td>
                  <td className="p-3 text-center text-black">
                    {salesSummary.totals.totalQrisQty}
                  </td>
                  <td className="p-3 text-right text-green-700 font-mono border-r border-gray-200">
                    {formatCurrency(salesSummary.totals.totalQrisNominal)}
                  </td>
                  <td className="p-3 text-center text-black">
                    {salesSummary.totals.totalCardQty}
                  </td>
                  <td className="p-3 text-right text-gray-800 font-mono border-r border-gray-200">
                    {formatCurrency(salesSummary.totals.totalCardNominal)}
                  </td>
                  <td className="p-3 text-center text-black bg-orange-100/50">
                    {salesSummary.totals.totalQrisQty + salesSummary.totals.totalCardQty}
                  </td>
                  <td className="p-3 text-right text-[#fb9418] text-base font-mono bg-orange-100/50">
                    {formatCurrency(salesSummary.totals.totalQrisNominal + salesSummary.totals.totalCardNominal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* TABEL KEPADATAN PENGUNJUNG (INTERVAL 30 MENIT) */}
        <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          
          <div className="p-5 border-b border-gray-200 bg-white flex justify-between items-center">
            <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">
              Kepadatan Pengunjung (Per 30 Menit)
            </h4>
          </div>

          {/* Tabel Interval */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-widest border-b-2 border-gray-200">
                  <th className="p-3 w-1/4">Rentang Waktu</th>
                  <th className="p-3 text-center border-l border-gray-200 w-1/6">Lantai 1</th>
                  <th className="p-3 text-center border-l border-gray-200 w-1/6">Lantai 5</th>
                  <th className="p-3 text-center border-l border-gray-200 w-1/6">Lantai 6/7</th>
                  <th className="p-3 text-center border-l border-gray-300 text-black w-1/4">Total Pengunjung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm bg-white font-medium text-gray-700">
                {timeIntervalStats.length > 0 ? (
                  timeIntervalStats.map((interval, idx) => (
                    <tr key={idx} className="hover:bg-orange-50/50 transition-colors">
                      <td className="p-3 font-bold text-gray-800">{interval.label}</td>
                      <td className={`p-3 text-center border-l border-gray-100 ${interval.floor1 > 0 ? 'text-black font-bold' : 'text-gray-300'}`}>
                        {interval.floor1}
                      </td>
                      <td className={`p-3 text-center border-l border-gray-100 ${interval.floor5 > 0 ? 'text-black font-bold' : 'text-gray-300'}`}>
                        {interval.floor5}
                      </td>
                      <td className={`p-3 text-center border-l border-gray-100 ${interval.floor67 > 0 ? 'text-black font-bold' : 'text-gray-300'}`}>
                        {interval.floor67}
                      </td>
                      <td className={`p-3 text-center border-l border-gray-200 font-black ${interval.total > 0 ? 'text-[#fb9418]' : 'text-gray-300'}`}>
                        {interval.total}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 italic">
                      Rentang waktu tidak valid atau kosong.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Baris Bawah: Summary Per Lantai & Summary Per Negara */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Bagian Summary Per Lantai (Total Keseluruhan) */}
          <div className="bg-[#fcfcfc] p-6 rounded-2xl shadow-sm border border-gray-200">
            <h4 className="text-sm font-extrabold text-black uppercase tracking-wider mb-5 border-b-2 border-gray-100 pb-3">
              Kunjungan Per Lantai (Total)
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
                <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg">Belum ada data lantai pada rentang waktu ini.</p>
              )}
            </div>
          </div>

          {/* Bagian Summary Per Negara */}
          <div className="bg-[#fcfcfc] p-6 rounded-2xl shadow-sm border border-gray-200">
            <h4 className="text-sm font-extrabold text-black uppercase tracking-wider mb-5 border-b-2 border-gray-100 pb-3">
              Distribusi Negara
            </h4>
            
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
                <p className="text-gray-400 italic text-sm col-span-full text-center py-4 bg-gray-50 rounded-lg">Belum ada data negara pada rentang waktu ini.</p>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Summary;