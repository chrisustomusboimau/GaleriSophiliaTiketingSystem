/**
 * EditTransactionModal.tsx
 * ----------------------------------------------------
 * Komponen modal (popup) untuk mengedit, mengubah status,
 * dan menghapus transaksi tiket pengunjung.
 * Diperbarui dengan identitas visual Galeria Sophilia untuk Admin.
 * FIX: Perbaikan permanen input manual pada kolom "Asal Negara".
 */

import React, { useState, useEffect, useMemo } from "react";
import { getData } from "country-list";
import { formatCurrency, calculateAggregatePrices, calculateTotalPrice } from "../utils/priceCalculator";

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

export interface TransactionData {
  id: string;
  queue_number: number;
  status: "pending" | "paid" | "cancelled" | "confirmed" | string;
  total_price: number;
  items: TransactionItem[];
  origins?: TransactionOrigin[]; 
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
  onSave: (id: string, updatedData: { items?: TransactionItem[]; origins?: TransactionOrigin[]; status?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const AVAILABLE_FLOORS = ["Floor 1", "Floor 5", "Floor 6/7"];
type AgeCategoryKey = 'adult' | 'student' | 'child';

// --- DATA NEGARA ---
const COUNTRIES = Object.freeze(
  getData().map((c) => ({
    code: c.code.toLowerCase(),
    name: c.name,
  }))
);

interface CountryVisitorState {
  countryCode: string;
  count: number | string;
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSave,
  onDelete,
}) => {
  // --- Local State ---
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const [counts, setCounts] = useState<{ adult: number | string, student: number | string, child: number | string }>({ 
    adult: 0, student: 0, child: 0 
  });
  
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitorState[]>([
    { countryCode: "id", count: 1 } 
  ]);

  const [editedStatus, setEditedStatus] = useState<string>("pending");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Initialization ---
  useEffect(() => {
    if (transaction && isOpen) {
      const initialFloors = Array.from(new Set(transaction.items.map(item => item.floor)));
      setSelectedFloors(initialFloors);

      let ad = 0, st = 0, ch = 0;
      transaction.items.forEach(item => {
        const cat = item.age_category.toLowerCase();
        if (cat === 'adult') ad = Math.max(ad, item.quantity);
        if (cat === 'student' || cat === 'teen') st = Math.max(st, item.quantity);
        if (cat === 'child') ch = Math.max(ch, item.quantity);
      });
      setCounts({ adult: ad, student: st, child: ch });

      if (transaction.origins && transaction.origins.length > 0) {
        setCountryVisitors(
          transaction.origins.map(o => ({
            countryCode: o.country_code,
            count: o.count
          }))
        );
      } else {
        const totalInit = ad + st + ch;
        setCountryVisitors([{ countryCode: "id", count: totalInit > 0 ? totalInit : 1 }]);
      }

      setEditedStatus(transaction.status);
      setError(null);
    }
  }, [transaction, isOpen]);

  // --- Derived Data ---
  const pureCounts = useMemo(() => ({
    adult: Number(counts.adult) || 0,
    student: Number(counts.student) || 0,
    child: Number(counts.child) || 0,
  }), [counts]);

  const newTotalPrice = useMemo(() => {
    const aggregatePrices = calculateAggregatePrices(selectedFloors);
    return calculateTotalPrice(pureCounts, aggregatePrices);
  }, [selectedFloors, pureCounts]);

  const totalPeople = useMemo(() => {
    return pureCounts.adult + pureCounts.student + pureCounts.child;
  }, [pureCounts]);

  // KALKULASI AMAN: Memastikan string diproses dengan benar menjadi angka untuk dijumlahkan
  const totalFromCountries = useMemo(() => {
    return countryVisitors.reduce((sum, c) => {
      const val = parseInt(c.count as string, 10);
      return sum + (isNaN(val) ? 0 : Math.max(0, val));
    }, 0);
  }, [countryVisitors]);


  // --- Input Handlers ---
  const handleFloorToggle = (floor: string) => {
    setSelectedFloors(prev => 
      prev.includes(floor) ? prev.filter(f => f !== floor) : [...prev, floor]              
    );
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCounts(prev => ({ 
      ...prev, 
      [name]: value === "" ? "" : Math.max(0, parseInt(value) || 0) 
    }));
  };

  const adjustCount = (category: AgeCategoryKey, delta: number) => {
    setCounts(prev => ({
      ...prev,
      [category]: Math.max(0, (Number(prev[category]) || 0) + delta)
    }));
  };

  // --- Input Handlers: Negara (PERBAIKAN UTAMA) ---
  const handleAddCountry = () => {
    setCountryVisitors((prev) => [...prev, { countryCode: "id", count: "" }]); // Set empty agar langsung bisa diketik
  };

  const handleUpdateCountry = (index: number, key: keyof CountryVisitorState, value: string) => {
    setCountryVisitors((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        // Simpan persis apa yang diketik user (tanpa parseInt) agar input box tidak macet saat diketik
        return { ...c, [key]: value };
      })
    );
  };

  const handleRemoveCountry = (index: number) => {
    setCountryVisitors((prev) => prev.filter((_, i) => i !== index));
  };


  // --- Action Handlers ---
  const handleSave = async () => {
    if (!transaction) return;

    if (selectedFloors.length === 0 && editedStatus !== "cancelled") {
      setError("Silakan pilih setidaknya 1 lantai, atau ubah status menjadi Cancelled.");
      return;
    }

    if (totalPeople === 0 && editedStatus !== "cancelled") {
      setError("Jumlah pengunjung tidak boleh 0. Hapus transaksi atau ubah status ke Cancelled.");
      return;
    }

    if (totalPeople !== totalFromCountries && editedStatus !== "cancelled") {
      setError(`Jumlah total usia pengunjung (${totalPeople}) tidak sama dengan total pengunjung dari daftar asal negara (${totalFromCountries}).`);
      return;
    }

    const payloadItems: TransactionItem[] = [];
    selectedFloors.forEach(floor => {
      if (pureCounts.adult > 0) payloadItems.push({ floor, age_category: 'adult', quantity: pureCounts.adult, unit_price: 0 });
      if (pureCounts.student > 0) payloadItems.push({ floor, age_category: 'student', quantity: pureCounts.student, unit_price: 0 });
      if (pureCounts.child > 0) payloadItems.push({ floor, age_category: 'child', quantity: pureCounts.child, unit_price: 0 });
    });

    // Validasi akhir sebelum dikirim ke backend: Pastikan nilai kosong/string yang tidak valid jadi 0
    const payloadOrigins: TransactionOrigin[] = countryVisitors.map((c) => ({
      country_code: c.countryCode,
      count: Math.max(0, parseInt(c.count as string, 10) || 0),
    }));

    try {
      setIsSaving(true);
      setError(null);
      await onSave(transaction.id, {
        items: payloadItems, 
        origins: payloadOrigins,
        status: editedStatus,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan perubahan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus transaksi antrian ${transaction.queue_number} secara permanen?`
    );
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      setError(null);
      await onDelete(transaction.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Gagal menghapus transaksi.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] border border-gray-200">
        
        {/* HEADER: Tema Hitam - Oranye */}
        <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Edit Transaksi</h3>
            <p className="text-[11px] text-gray-400 font-mono mt-1">Antrian: <span className="font-bold text-[#fb9418] text-sm">#{transaction.queue_number}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl px-2 transition-colors">✕</button>
        </header>

        {/* BODY */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r shadow-sm flex items-start gap-2">
              <span className="font-bold mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. STATUS DROPDOWN */}
          <div className="mb-6">
            <label className="block text-sm font-extrabold text-black uppercase tracking-wide mb-2">Status Pembayaran</label>
            <select
              value={editedStatus}
              onChange={(e) => setEditedStatus(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white font-bold text-gray-800 shadow-sm cursor-pointer"
            >
              <option value="pending">🟡 Menunggu (Pending)</option>
              <option value="confirmed">🟢 Dikonfirmasi (Confirmed)</option>
              <option value="cancelled">🔴 Batal (Cancelled)</option>
            </select>
          </div>

          <hr className="mb-6 border-gray-200" />

          {/* 2. PILIHAN LANTAI */}
          <div className="mb-6">
            <label className="block text-sm font-extrabold text-black uppercase tracking-wide mb-3">Ubah Pilihan Lantai</label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_FLOORS.map((floor) => (
                <label 
                  key={floor} 
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors shadow-sm ${
                    selectedFloors.includes(floor) 
                      ? 'bg-orange-50 border-[#fb9418] ring-1 ring-[#fb9418]' 
                      : 'bg-white border-gray-300 hover:border-[#fb9418] hover:bg-orange-50/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFloors.includes(floor)}
                    onChange={() => handleFloorToggle(floor)}
                    disabled={isSaving}
                    className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418]"
                  />
                  <span className="ml-3 text-sm font-bold text-black">{floor}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. JUMLAH PENGUNJUNG USIA */}
          <div className="mb-6">
            <label className="block text-sm font-extrabold text-black uppercase tracking-wide mb-3">Kategori Usia</label>
            <div className="space-y-3">
              
              {/* Dewasa */}
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <label className="text-sm font-bold text-gray-700">Dewasa (22+ thn)</label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                  <button type="button" onClick={() => adjustCount('adult', -1)} disabled={isSaving || (Number(counts.adult) <= 0)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">-</button>
                  <input type="number" name="adult" min="0" value={counts.adult} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSaving} className="w-12 h-10 text-center font-bold text-black border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-[#fb9418] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => adjustCount('adult', 1)} disabled={isSaving} className="w-10 h-10 flex items-center justify-center font-bold text-[#fb9418] hover:bg-orange-50 transition-colors">+</button>
                </div>
              </div>

              {/* Remaja */}
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <label className="text-sm font-bold text-gray-700">Remaja ({'<'} 22 thn)</label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                  <button type="button" onClick={() => adjustCount('student', -1)} disabled={isSaving || (Number(counts.student) <= 0)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">-</button>
                  <input type="number" name="student" min="0" value={counts.student} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSaving} className="w-12 h-10 text-center font-bold text-black border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-[#fb9418] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => adjustCount('student', 1)} disabled={isSaving} className="w-10 h-10 flex items-center justify-center font-bold text-[#fb9418] hover:bg-orange-50 transition-colors">+</button>
                </div>
              </div>

              {/* Anak */}
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                <label className="text-sm font-bold text-gray-700">Anak ({'<'} 8 thn)</label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                  <button type="button" onClick={() => adjustCount('child', -1)} disabled={isSaving || (Number(counts.child) <= 0)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors">-</button>
                  <input type="number" name="child" min="0" value={counts.child} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSaving} className="w-12 h-10 text-center font-bold text-black border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-[#fb9418] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => adjustCount('child', 1)} disabled={isSaving} className="w-10 h-10 flex items-center justify-center font-bold text-[#fb9418] hover:bg-orange-50 transition-colors">+</button>
                </div>
              </div>

            </div>
          </div>

          {/* 4. ASAL NEGARA */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-extrabold text-black uppercase tracking-wide">Asal Negara</label>
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                  totalPeople !== totalFromCountries 
                    ? 'bg-red-50 text-red-600 border-red-200' 
                    : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                {totalFromCountries} / {totalPeople} Orang
              </span>
            </div>
            
            <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              {countryVisitors.map((country, index) => (
                <div key={index} className="flex flex-row items-center gap-2 w-full">
                  <select
                    value={country.countryCode}
                    onChange={(e) => handleUpdateCountry(index, "countryCode", e.target.value)}
                    disabled={isSaving}
                    className="flex-[3] min-w-0 p-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] text-sm text-black truncate transition-shadow cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={0}
                    value={country.count}
                    onChange={(e) => handleUpdateCountry(index, "count", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    disabled={isSaving}
                    placeholder="0"
                    className="flex-1 min-w-0 p-2 text-center font-bold text-black bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none transition-shadow"
                  />

                  {countryVisitors.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(index)}
                      disabled={isSaving}
                      className="flex-none w-8 h-8 flex items-center justify-center font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >✕</button>
                  ) : (
                    <div className="w-8 flex-none" />
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={handleAddCountry}
                disabled={isSaving}
                className="mt-3 text-sm font-bold text-[#fb9418] hover:text-orange-600 transition-colors flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span> Tambah Negara
              </button>
            </div>
          </div>

        </div>

        {/* FOOTER & TOTALS */}
        <div className="bg-white border-t p-5 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-5 p-4 bg-orange-50 border border-orange-100 rounded-xl">
            <div>
              <span className="text-black text-sm font-bold uppercase tracking-wider block">Total Tagihan Baru</span>
              <span className="text-[10px] text-gray-500 font-mono">(Dihitung otomatis)</span>
            </div>
            <span className={`text-3xl font-black ${newTotalPrice !== transaction.total_price ? 'text-[#fb9418]' : 'text-black'}`}>
              {formatCurrency(newTotalPrice)}
            </span>
          </div>

          <div className="flex gap-3">
            <button onClick={handleDelete} disabled={isSaving || isDeleting} className="px-4 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-200">
              {isDeleting ? "Menghapus..." : "Hapus Tiket"}
            </button>
            <div className="flex-1 flex gap-3 justify-end">
              <button onClick={onClose} disabled={isSaving || isDeleting} className="px-5 py-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-black font-bold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200">
                Batal
              </button>
              {/* Tombol Utama Oranye */}
              <button onClick={handleSave} disabled={isSaving || isDeleting} className="px-6 py-3 bg-[#fb9418] text-[#fcfcfc] hover:bg-orange-500 font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1">
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EditTransactionModal;