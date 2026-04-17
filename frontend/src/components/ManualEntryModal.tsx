/**
 * ManualEntryModal.tsx
 * ----------------------------------------------------
 * Modal bagi admin/kasir untuk membuat transaksi baru secara manual.
 * Mengonversi pilihan menjadi array 'items' untuk dikirim ke backend.
 * Akan memberikan nomor antrean ke parent component saat sukses.
 * Dilengkapi input asal negara untuk pengunjung walk-in.
 */

import React, { useState, useMemo } from 'react';
import { getData } from "country-list";

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (queueNumber: number) => void;
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

interface CountryVisitor {
  countryCode: string;
  count: number | string;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [selectedFloors, setSelectedFloors] = useState<string[]>(["Floor 1"]);
  const [counts, setCounts] = useState<{ adult: number | string, student: number | string, child: number | string }>({ 
    adult: 0, 
    student: 0, 
    child: 0 
  });
  
  // State untuk Asal Negara, default 1 orang dari Indonesia ("id")
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([
    { countryCode: "id", count: 1 }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Derived Data untuk Indikator Sinkronisasi ---
  const pureCounts = useMemo(() => ({
    adult: Number(counts.adult) || 0,
    student: Number(counts.student) || 0,
    child: Number(counts.child) || 0,
  }), [counts]);

  const totalPeople = useMemo(() => {
    return pureCounts.adult + pureCounts.student + pureCounts.child;
  }, [pureCounts]);

  const totalFromCountries = useMemo(() => {
    return countryVisitors.reduce((sum, c) => sum + (Number(c.count) || 0), 0);
  }, [countryVisitors]);

  if (!isOpen) return null;

  // --- Handlers Lantai & Umur ---
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

  // --- Handlers Asal Negara ---
  const handleAddCountry = () => {
    setCountryVisitors((prev) => [...prev, { countryCode: "id", count: 1 }]);
  };

  const handleUpdateCountry = (index: number, key: keyof CountryVisitor, value: string | number) => {
    setCountryVisitors((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        if (key === "countryCode") {
          return { ...c, countryCode: value as string };
        }
        if (key === "count") {
          return { ...c, count: value === "" ? "" : Math.max(0, parseInt(value as string) || 0) };
        }
        return c;
      })
    );
  };

  const handleRemoveCountry = (index: number) => {
    setCountryVisitors((prev) => prev.filter((_, i) => i !== index));
  };


  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFloors.length === 0) {
      alert("Silakan pilih setidaknya 1 lantai.");
      return;
    }

    if (totalPeople === 0) {
      alert("Silakan masukkan setidaknya 1 orang pengunjung.");
      return;
    }

    // Validasi agar jumlah orang di rentang usia == jumlah orang di daftar negara
    if (totalPeople !== totalFromCountries) {
      alert(`Jumlah total usia pengunjung (${totalPeople}) tidak sama dengan total pengunjung dari daftar asal negara (${totalFromCountries}).`);
      return;
    }

    const payloadItems: { floor: string; age_category: string; quantity: number }[] = [];
    selectedFloors.forEach(floor => {
      if (pureCounts.adult > 0) payloadItems.push({ floor, age_category: 'adult', quantity: pureCounts.adult });
      if (pureCounts.student > 0) payloadItems.push({ floor, age_category: 'student', quantity: pureCounts.student });
      if (pureCounts.child > 0) payloadItems.push({ floor, age_category: 'child', quantity: pureCounts.child });
    });

    const payloadOrigins = countryVisitors.map((c) => ({
      country_code: c.countryCode,
      count: Number(c.count) || 0,
    }));

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, origins: payloadOrigins }),
      });

      if (!response.ok) throw new Error("Gagal membuat transaksi manual.");

      const data = await response.json();
      
      handleClose();
      onSuccess(data.queue_number); 
      
    } catch (error) {
      console.error("Manual entry error:", error);
      alert("Gagal menambahkan pengunjung. Silakan periksa koneksi Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedFloors(["Floor 1"]);
    setCounts({ adult: 0, student: 0, child: 0 });
    setCountryVisitors([{ countryCode: "id", count: 1 }]); // Reset origin data
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) handleClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm transition-opacity"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
        
        <div className="bg-emerald-600 px-5 py-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold text-lg">Tambah Pengunjung Manual</h3>
          <button onClick={handleClose} disabled={isSubmitting} className="text-emerald-100 hover:text-white text-2xl font-bold leading-none focus:outline-none transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col max-h-[85vh]">
          
          {/* Scrollable Area */}
          <div className="overflow-y-auto pr-1 space-y-6 flex-1">
            
            {/* BAGIAN 1: PILIH LANTAI */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-3 border-b pb-1">
                1. Pilih Lantai yang Dikunjungi
              </label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_FLOORS.map((floor) => (
                  <label key={floor} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${selectedFloors.includes(floor) ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selectedFloors.includes(floor)} onChange={() => handleFloorToggle(floor)} disabled={isSubmitting} className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                    <span className="ml-3 text-sm font-medium text-gray-700">{floor}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* BAGIAN 2: JUMLAH ORANG */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-3 border-b pb-1">
                2. Kategori Usia
              </label>
              <div className="space-y-3">
                
                {/* Dewasa */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-gray-700">Dewasa (22+ thn)</label>
                  <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                    <button type="button" onClick={() => adjustCount('adult', -1)} disabled={isSubmitting || Number(counts.adult) <= 0} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">-</button>
                    <input type="number" name="adult" min="0" value={counts.adult} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSubmitting} className="w-12 h-8 text-center font-bold border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button type="button" onClick={() => adjustCount('adult', 1)} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center font-bold text-emerald-600 hover:bg-emerald-50">+</button>
                  </div>
                </div>

                {/* Remaja */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-gray-700">Remaja ({'<'} 22 thn)</label>
                  <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                    <button type="button" onClick={() => adjustCount('student', -1)} disabled={isSubmitting || Number(counts.student) <= 0} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">-</button>
                    <input type="number" name="student" min="0" value={counts.student} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSubmitting} className="w-12 h-8 text-center font-bold border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button type="button" onClick={() => adjustCount('student', 1)} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center font-bold text-emerald-600 hover:bg-emerald-50">+</button>
                  </div>
                </div>

                {/* Anak */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-gray-700">Anak ({'<'} 8 thn)</label>
                  <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                    <button type="button" onClick={() => adjustCount('child', -1)} disabled={isSubmitting || Number(counts.child) <= 0} className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">-</button>
                    <input type="number" name="child" min="0" value={counts.child} onChange={handleCountChange} onFocus={(e) => e.target.select()} disabled={isSubmitting} className="w-12 h-8 text-center font-bold border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button type="button" onClick={() => adjustCount('child', 1)} disabled={isSubmitting} className="w-8 h-8 flex items-center justify-center font-bold text-emerald-600 hover:bg-emerald-50">+</button>
                  </div>
                </div>

              </div>
            </div>

            {/* BAGIAN 3: ASAL NEGARA */}
            <div>
              <div className="flex justify-between items-center mb-3 border-b pb-1">
                <label className="block text-sm font-bold text-gray-800">
                  3. Asal Negara
                </label>
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
                      disabled={isSubmitting}
                      className="flex-[3] min-w-0 p-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm truncate"
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
                      disabled={isSubmitting}
                      className="flex-1 min-w-0 p-2 text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none"
                    />

                    {countryVisitors.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveCountry(index)}
                        disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  className="mt-2 text-sm font-bold text-emerald-600 hover:text-emerald-800 transition flex items-center gap-1"
                >
                  <span className="text-lg">+</span> Tambah Negara
                </button>
              </div>
            </div>

          </div>

          {/* BUTTONS (Fixed at bottom) */}
          <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-gray-200 shrink-0 bg-white">
            <button 
              type="button" 
              onClick={handleClose} 
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
            >
              Batal
            </button>
            
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center min-w-[140px] disabled:opacity-50"
            >
              {isSubmitting ? "Memproses..." : "Buat Tiket"}
            </button>
          </div>
        </form>
        
      </div>
    </div>
  );
};

export default ManualEntryModal;