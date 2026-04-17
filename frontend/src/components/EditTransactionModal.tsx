/**
 * EditTransactionModal.tsx
 * ----------------------------------------------------
 * Komponen modal (popup) untuk mengedit, mengubah status,
 * dan menghapus transaksi tiket pengunjung.
 * Mode Edit: Menggunakan pilihan Lantai, Jumlah Orang global,
 * dan sekarang dilengkapi dengan pengeditan Asal Negara (Origins).
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
  status: "pending" | "paid" | "cancelled" | string;
  total_price: number;
  items: TransactionItem[];
  origins?: TransactionOrigin[]; // Ditambahkan untuk menampung data asal
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
  
  // State untuk Asal Negara
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitorState[]>([
    { countryCode: "id", count: 1 } // Default fallback
  ]);

  const [editedStatus, setEditedStatus] = useState<string>("pending");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Initialization ---
  useEffect(() => {
    if (transaction && isOpen) {
      // 1. Ekstrak Lantai
      const initialFloors = Array.from(new Set(transaction.items.map(item => item.floor)));
      setSelectedFloors(initialFloors);

      // 2. Ekstrak Kategori Usia
      let ad = 0, st = 0, ch = 0;
      transaction.items.forEach(item => {
        const cat = item.age_category.toLowerCase();
        if (cat === 'adult') ad = Math.max(ad, item.quantity);
        if (cat === 'student' || cat === 'teen') st = Math.max(st, item.quantity);
        if (cat === 'child') ch = Math.max(ch, item.quantity);
      });
      setCounts({ adult: ad, student: st, child: ch });

      // 3. Ekstrak Asal Negara (Origins)
      if (transaction.origins && transaction.origins.length > 0) {
        setCountryVisitors(
          transaction.origins.map(o => ({
            countryCode: o.country_code,
            count: o.count
          }))
        );
      } else {
        // Jika karena alasan tertentu origins kosong, set default ke ID dengan jumlah total tiket
        const totalInit = ad + st + ch;
        setCountryVisitors([{ countryCode: "id", count: totalInit > 0 ? totalInit : 1 }]);
      }

      // 4. Set Status
      setEditedStatus(transaction.status);
      setError(null);
    }
  }, [transaction, isOpen]);

  // --- Derived Data (Kalkulasi Harga & Total Orang) ---
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

  const totalFromCountries = useMemo(() => {
    return countryVisitors.reduce((sum, c) => sum + (Number(c.count) || 0), 0);
  }, [countryVisitors]);


  // --- Input Handlers: Lantai & Usia ---
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

  // --- Input Handlers: Negara ---
  const handleAddCountry = () => {
    setCountryVisitors((prev) => [...prev, { countryCode: "id", count: 1 }]);
  };

  const handleUpdateCountry = (index: number, key: keyof CountryVisitorState, value: string | number) => {
    setCountryVisitors((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        if (key === "countryCode") return { ...c, countryCode: value as string };
        if (key === "count") return { ...c, count: value === "" ? "" : Math.max(0, parseInt(value as string) || 0) };
        return c;
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

    // Validasi sinkronisasi data negara vs usia
    if (totalPeople !== totalFromCountries && editedStatus !== "cancelled") {
      setError(`Jumlah total usia pengunjung (${totalPeople}) tidak sama dengan total pengunjung dari daftar asal negara (${totalFromCountries}).`);
      return;
    }

    // 1. Persiapkan payload items
    const payloadItems: TransactionItem[] = [];
    selectedFloors.forEach(floor => {
      if (pureCounts.adult > 0) payloadItems.push({ floor, age_category: 'adult', quantity: pureCounts.adult, unit_price: 0 });
      if (pureCounts.student > 0) payloadItems.push({ floor, age_category: 'student', quantity: pureCounts.student, unit_price: 0 });
      if (pureCounts.child > 0) payloadItems.push({ floor, age_category: 'child', quantity: pureCounts.child, unit_price: 0 });
    });

    // 2. Persiapkan payload origins
    const payloadOrigins: TransactionOrigin[] = countryVisitors.map((c) => ({
      country_code: c.countryCode,
      count: Number(c.count) || 0,
    }));

    try {
      setIsSaving(true);
      setError(null);
      await onSave(transaction.id, {
        items: payloadItems, 
        origins: payloadOrigins, // Kirimkan data origins yang baru
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* HEADER */}
        <header className="bg-slate-50 border-b p-5 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Edit Transaksi</h3>
            <p className="text-sm text-gray-500">Antrian: <span className="font-bold text-blue-700">#{transaction.queue_number}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl px-2">✕</button>
        </header>

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-5 p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r shadow-sm flex items-start gap-2">
              <span className="font-bold mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. STATUS DROPDOWN */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">Status Pembayaran</label>
            <select
              value={editedStatus}
              onChange={(e) => setEditedStatus(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
            >
              <option value="pending">🟡 Menunggu (Pending)</option>
              <option value="paid">🟢 Lunas (Paid)</option>
              <option value="cancelled">🔴 Batal (Cancelled)</option>
            </select>
          </div>

          <hr className="mb-6 border-dashed border-gray-200" />

          {/* 2. PILIHAN LANTAI */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">Ubah Pilihan Lantai</label>
            <div className="grid grid-cols-2 gap-3">
              {AVAILABLE_FLOORS.map((floor) => (
                <label 
                  key={floor} 
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFloors.includes(floor) 
                      ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFloors.includes(floor)}
                    onChange={() => handleFloorToggle(floor)}
                    disabled={isSaving}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-700">{floor}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. JUMLAH PENGUNJUNG USIA */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-3">Ubah Jumlah Kategori Usia</label>
            <div className="space-y-3">
              
              {/* Dewasa */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="text-sm font-medium text-gray-700">Dewasa (22+ thn)</label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                  <button type="button" onClick={() => adjustCount('adult', -1)} disabled={isSaving || (Number(counts.adult) <= 0)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">-</button>
                  <input type="number" name="adult" min="0" value={counts.adult} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSaving} className="w-12 h-10 text-center font-bold border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => adjustCount('adult', 1)} disabled={isSaving} className="w-10 h-10 flex items-center justify-center font-bold text-blue-600 hover:bg-blue-50">+</button>
                </div>
              </div>

              {/* Remaja */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="text-sm font-medium text-gray-700">Remaja ({'<'} 22 thn)</label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                  <button type="button" onClick={() => adjustCount('student', -1)} disabled={isSaving || (Number(counts.student) <= 0)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">-</button>
                  <input type="number" name="student" min="0" value={counts.student} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSaving} className="w-12 h-10 text-center font-bold border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => adjustCount('student', 1)} disabled={isSaving} className="w-10 h-10 flex items-center justify-center font-bold text-blue-600 hover:bg-blue-50">+</button>
                </div>
              </div>

              {/* Anak */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="text-sm font-medium text-gray-700">Anak ({'<'} 8 thn)</label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                  <button type="button" onClick={() => adjustCount('child', -1)} disabled={isSaving || (Number(counts.child) <= 0)} className="w-10 h-10 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">-</button>
                  <input type="number" name="child" min="0" value={counts.child} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSaving} className="w-12 h-10 text-center font-bold border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button type="button" onClick={() => adjustCount('child', 1)} disabled={isSaving} className="w-10 h-10 flex items-center justify-center font-bold text-blue-600 hover:bg-blue-50">+</button>
                </div>
              </div>

            </div>
          </div>

          {/* 4. ASAL NEGARA */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-bold text-gray-700">Ubah Asal Negara</label>
              <span className={`text-xs font-bold px-2 py-1 rounded ${totalPeople !== totalFromCountries ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {totalFromCountries} / {totalPeople} Orang
              </span>
            </div>
            
            <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              {countryVisitors.map((country, index) => (
                <div key={index} className="flex flex-row items-center gap-2 w-full">
                  <select
                    value={country.countryCode}
                    onChange={(e) => handleUpdateCountry(index, "countryCode", e.target.value)}
                    disabled={isSaving}
                    className="flex-[3] min-w-0 p-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm truncate"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min={1}
                    value={country.count}
                    onChange={(e) => handleUpdateCountry(index, "count", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    disabled={isSaving}
                    className="flex-1 min-w-0 p-2 text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  />

                  {countryVisitors.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(index)}
                      disabled={isSaving}
                      className="flex-none w-8 h-8 flex items-center justify-center font-bold text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
                className="mt-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
              >
                <span className="text-lg">+</span> Tambah Negara
              </button>
            </div>
          </div>

        </div>

        {/* FOOTER & TOTALS */}
        <div className="bg-white border-t p-5 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-4 p-3 bg-blue-50 rounded-lg">
            <div>
              <span className="text-gray-600 text-sm font-medium block">Total Tagihan:</span>
              <span className="text-xs text-gray-500">(Dihitung ulang otomatis)</span>
            </div>
            <span className={`text-2xl font-black ${newTotalPrice !== transaction.total_price ? 'text-blue-700' : 'text-gray-800'}`}>
              {formatCurrency(newTotalPrice)}
            </span>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleDelete} disabled={isSaving || isDeleting} className="px-4 py-2 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 font-bold rounded-lg transition-colors disabled:opacity-50">
              {isDeleting ? "Hapus..." : "Hapus"}
            </button>
            <div className="flex-1 flex gap-3 justify-end">
              <button onClick={onClose} disabled={isSaving || isDeleting} className="px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-bold rounded-lg transition-colors">
                Batal
              </button>
              <button onClick={handleSave} disabled={isSaving || isDeleting} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
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