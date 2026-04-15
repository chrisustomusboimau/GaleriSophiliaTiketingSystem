/**
 * ManualEntryModal.tsx
 * ----------------------------------------------------
 * Modal bagi admin/kasir untuk membuat transaksi baru secara manual.
 * Mengonversi pilihan menjadi array 'items' untuk dikirim ke backend.
 * Akan memberikan nomor antrean ke parent component saat sukses.
 * Dilengkapi tombol +/- untuk kemudahan input dan perbaikan bug angka 0.
 */

import React, { useState } from 'react';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (queueNumber: number) => void;
}

const AVAILABLE_FLOORS = ["Floor 1", "Floor 5", "Floor 6/7"];

type AgeCategoryKey = 'adult' | 'student' | 'child';

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [selectedFloors, setSelectedFloors] = useState<string[]>(["Floor 1"]);
  
  // Menggunakan tipe number | string untuk membolehkan string kosong ("") saat dihapus
  const [counts, setCounts] = useState<{ adult: number | string, student: number | string, child: number | string }>({ 
    adult: 0, 
    student: 0, 
    child: 0 
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleFloorToggle = (floor: string) => {
    setSelectedFloors(prev => 
      prev.includes(floor) 
        ? prev.filter(f => f !== floor) 
        : [...prev, floor]              
    );
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCounts(prev => ({ 
      ...prev, 
      // Jika input kosong, simpan "", jika tidak, parse menjadi number
      [name]: value === "" ? "" : Math.max(0, parseInt(value) || 0) 
    }));
  };

  // Handler khusus untuk tombol +/-
  const adjustCount = (category: AgeCategoryKey, delta: number) => {
    setCounts(prev => {
      // Pastikan nilai dikonversi menjadi number, anggap "" adalah 0
      const currentValue = Number(prev[category]) || 0;
      return {
        ...prev,
        [category]: Math.max(0, currentValue + delta)
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFloors.length === 0) {
      alert("Silakan pilih setidaknya 1 lantai.");
      return;
    }

    // Konversi state string/number menjadi pure number untuk kalkulasi dan API
    const adultCount = Number(counts.adult) || 0;
    const studentCount = Number(counts.student) || 0;
    const childCount = Number(counts.child) || 0;

    const totalPeople = adultCount + studentCount + childCount;
    if (totalPeople === 0) {
      alert("Silakan masukkan setidaknya 1 orang pengunjung.");
      return;
    }

    const payloadItems: { floor: string; age_category: string; quantity: number }[] = [];
    
    selectedFloors.forEach(floor => {
      if (adultCount > 0) payloadItems.push({ floor, age_category: 'adult', quantity: adultCount });
      if (studentCount > 0) payloadItems.push({ floor, age_category: 'student', quantity: studentCount });
      if (childCount > 0) payloadItems.push({ floor, age_category: 'child', quantity: childCount });
    });

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payloadItems, origins: [] }),
      });

      if (!response.ok) throw new Error("Gagal membuat transaksi manual.");

      const data = await response.json();
      
      // Bersihkan modal dan teruskan nomor antrian ke komponen induk
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        
        <div className="bg-emerald-600 px-5 py-4 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Tambah Pengunjung Manual</h3>
          <button 
            onClick={handleClose} 
            disabled={isSubmitting}
            className="text-emerald-100 hover:text-white text-2xl font-bold leading-none focus:outline-none transition-colors"
          >
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col max-h-[85vh]">
          <div className="bg-emerald-50 text-emerald-800 text-sm p-4 rounded-lg mb-5 border border-emerald-100 flex gap-3 items-start shadow-sm">
            <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Tiket yang ditambahkan di sini akan langsung masuk ke antrian kasir untuk dikonfirmasi pembayarannya.</p>
          </div>

          <div className="overflow-y-auto pr-1 space-y-6">
            
            {/* BAGIAN 1: PILIH LANTAI */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-3 border-b pb-1">
                1. Pilih Lantai yang Dikunjungi
              </label>
              <div className="grid grid-cols-2 gap-3">
                {AVAILABLE_FLOORS.map((floor) => (
                  <label 
                    key={floor} 
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedFloors.includes(floor) 
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500' 
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFloors.includes(floor)}
                      onChange={() => handleFloorToggle(floor)}
                      disabled={isSubmitting}
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {floor}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* BAGIAN 2: JUMLAH ORANG */}
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-3 border-b pb-1">
                2. Jumlah Pengunjung (Orang)
              </label>
              <div className="space-y-3">
                
                {/* --- Dewasa --- */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-gray-700">Dewasa (22+ thn)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => adjustCount('adult', -1)}
                      disabled={isSubmitting || Number(counts.adult) <= 0}
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold text-gray-600 bg-white border border-gray-300 rounded-l-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      name="adult"
                      min="0"
                      value={counts.adult}
                      onChange={handleCountChange}
                      onFocus={(e) => e.target.select()} // Auto-select text
                      disabled={isSubmitting}
                      className="w-12 h-8 text-center border-y border-gray-300 bg-white outline-none focus:ring-inset focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => adjustCount('adult', 1)}
                      disabled={isSubmitting}
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold text-gray-600 bg-white border border-gray-300 rounded-r-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* --- Remaja --- */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-gray-700">Remaja (&lt; 22 thn)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => adjustCount('student', -1)}
                      disabled={isSubmitting || Number(counts.student) <= 0}
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold text-gray-600 bg-white border border-gray-300 rounded-l-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      name="student"
                      min="0"
                      value={counts.student}
                      onChange={handleCountChange}
                      onFocus={(e) => e.target.select()} // Auto-select text
                      disabled={isSubmitting}
                      className="w-12 h-8 text-center border-y border-gray-300 bg-white outline-none focus:ring-inset focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => adjustCount('student', 1)}
                      disabled={isSubmitting}
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold text-gray-600 bg-white border border-gray-300 rounded-r-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* --- Anak --- */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-gray-700">Anak (&lt; 8 thn)</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => adjustCount('child', -1)}
                      disabled={isSubmitting || Number(counts.child) <= 0}
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold text-gray-600 bg-white border border-gray-300 rounded-l-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      name="child"
                      min="0"
                      value={counts.child}
                      onChange={handleCountChange}
                      onFocus={(e) => e.target.select()} // Auto-select text
                      disabled={isSubmitting}
                      className="w-12 h-8 text-center border-y border-gray-300 bg-white outline-none focus:ring-inset focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => adjustCount('child', 1)}
                      disabled={isSubmitting}
                      className="w-8 h-8 flex items-center justify-center text-lg font-bold text-gray-600 bg-white border border-gray-300 rounded-r-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* BUTTONS */}
          <div className="flex justify-end gap-3 pt-5 mt-6 border-t border-gray-200">
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