/**
 * ManualEntryModal.tsx
 * ----------------------------------------------------
 * Modal bagi admin/kasir untuk membuat transaksi baru secara manual.
 * Menampilkan nomor antrian yang didapat sebelum menutup modal.
 */

import React, { useState } from 'react';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Fungsi untuk me-refresh data di dashboard
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [formData, setFormData] = useState({
    under_8_count: 0,
    under_22_count: 0,
    adult_count: 0,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  // DITAMBAHKAN: State untuk menyimpan nomor antrian yang baru dibuat
  const [createdQueueNumber, setCreatedQueueNumber] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: Math.max(0, parseInt(value) || 0) 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.under_8_count === 0 && formData.under_22_count === 0 && formData.adult_count === 0) {
      alert("Silakan masukkan setidaknya 1 tiket pengunjung.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          under_8_count: formData.under_8_count,
          under_22_count: formData.under_22_count,
          adult_count: formData.adult_count,
          origins: [] 
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal membuat transaksi manual.");
      }

      // 1. Ambil data balasan dari server (yang berisi queue_number)
      const data = await response.json();
      
      // 2. Refresh data di latar belakang
      onSuccess(); 
      
      // 3. Tampilkan halaman sukses dengan nomor antrian (jangan langsung ditutup)
      setCreatedQueueNumber(data.queue_number);
      
    } catch (error) {
      console.error("Manual entry error:", error);
      alert("Gagal menambahkan pengunjung. Silakan periksa koneksi Anda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset semua state saat modal benar-benar ditutup
    setFormData({ under_8_count: 0, under_22_count: 0, adult_count: 0 });
    setCreatedQueueNumber(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        
        {/* Header Modal */}
        <div className="bg-emerald-600 px-4 py-3 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Tambah Pengunjung Manual</h3>
          {/* Sembunyikan tombol silang jika sedang di layar sukses agar user fokus ke tombol Selesai */}
          {createdQueueNumber === null && (
            <button 
              onClick={handleClose} 
              className="text-white hover:text-gray-200 text-2xl font-bold leading-none focus:outline-none"
            >
              &times;
            </button>
          )}
        </div>
        
        {/* KONDISI: TAMPILKAN HALAMAN SUKSES JIKA PUNYA NOMOR ANTRIAN */}
        {createdQueueNumber !== null ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h4 className="text-xl font-bold text-gray-800">Tiket Berhasil Dibuat!</h4>
            <p className="text-gray-500 text-sm">Nomor antrian pengunjung ini adalah:</p>
            
            <div className="text-6xl font-extrabold text-emerald-600 py-4">
              {createdQueueNumber}
            </div>
            
            <button 
              onClick={handleClose} 
              className="w-full mt-4 px-4 py-3 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors"
            >
              Selesai & Tutup
            </button>
          </div>
        ) : (
          /* KONDISI: TAMPILKAN FORM INPUT JIKA BELUM ADA NOMOR ANTRIAN */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="bg-emerald-50 text-emerald-800 text-sm p-3 rounded-md mb-4 border border-emerald-100">
              Tiket yang ditambahkan di sini akan langsung masuk ke antrian kasir untuk dikonfirmasi pembayarannya.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anak (&lt; 8 thn)
              </label>
              <input
                type="number"
                name="under_8_count"
                min="0"
                value={formData.under_8_count}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 border outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Remaja (&lt; 22 thn)
              </label>
              <input
                type="number"
                name="under_22_count"
                min="0"
                value={formData.under_22_count}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 border outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dewasa (22+ thn)
              </label>
              <input
                type="number"
                name="adult_count"
                min="0"
                value={formData.adult_count}
                onChange={handleChange}
                disabled={isSubmitting}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2.5 border outline-none transition-colors"
              />
            </div>

            <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-gray-100">
              <button 
                type="button" 
                onClick={handleClose} 
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                Batal
              </button>
              
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm transition-colors flex items-center justify-center min-w-[140px]"
              >
                {isSubmitting ? "Memproses..." : "Buat Tiket"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ManualEntryModal;