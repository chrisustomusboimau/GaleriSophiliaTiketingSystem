/**
 * EditTransactionModal.tsx
 * ----------------------------------------------------
 * Komponen modal (popup) untuk mengedit dan menghapus transaksi tiket pengunjung.
 */

import React, { useState, useEffect } from 'react';

// Mendefinisikan tipe data yang dibutuhkan modal agar lebih aman (TypeScript)
export interface TransactionData {
  id: string;
  queue_number: number;
  under_8_count: number;
  under_22_count: number;
  adult_count: number;
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
  onSave: (id: string, updatedData: { under_8_count: number; under_22_count: number; adult_count: number }) => Promise<void>;
  // DITAMBAHKAN: Prop untuk fungsi hapus
  onDelete: (id: string) => Promise<void>; 
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  transaction, 
  onSave,
  onDelete // DITAMBAHKAN
}) => {
  // State untuk menyimpan data form yang sedang diedit
  const [formData, setFormData] = useState({
    under_8_count: 0,
    under_22_count: 0,
    adult_count: 0,
  });
  
  // State untuk menandakan proses loading
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // DITAMBAHKAN: Loading state untuk hapus

  // Efek ini berjalan setiap kali modal dibuka atau data transaksi yang dipilih berubah
  useEffect(() => {
    if (transaction) {
      setFormData({
        under_8_count: transaction.under_8_count,
        under_22_count: transaction.under_22_count,
        adult_count: transaction.adult_count,
      });
    }
  }, [transaction]);

  // Jika modal sedang ditutup atau tidak ada data, jangan render apa-apa
  if (!isOpen || !transaction) return null;

  // Handler untuk mendeteksi ketikan pada input angka
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Memastikan nilai yang dimasukkan selalu berupa angka (minimal 0)
    setFormData((prev) => ({ 
      ...prev, 
      [name]: Math.max(0, parseInt(value) || 0) 
    }));
  };

  // Handler saat form disubmit (tombol Simpan ditekan)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Memanggil fungsi onSave yang dilempar dari PaymentHistoryPage
      await onSave(transaction.id, formData);
      onClose(); // Tutup modal jika berhasil disimpan
    } catch (error) {
      console.error("Gagal menyimpan perubahan", error);
      alert("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  // DITAMBAHKAN: Handler saat tombol Hapus ditekan
  const handleDelete = async () => {
    // Tampilkan konfirmasi kepada pengguna sebelum benar-benar menghapus
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus tiket Antrian #${transaction.queue_number}? Tindakan ini tidak dapat dibatalkan.`
    );
    
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(transaction.id);
      onClose(); // Tutup modal jika berhasil dihapus
    } catch (error) {
      console.error("Gagal menghapus tiket", error);
      alert("Gagal menghapus tiket. Silakan periksa koneksi Anda dan coba lagi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 backdrop-blur-sm transition-opacity">
      {/* Container Modal */}
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        
        {/* Header Modal */}
        <div className="bg-blue-600 px-4 py-3 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">Edit Tiket #{transaction.queue_number}</h3>
          <button 
            onClick={onClose} 
            className="text-white hover:text-gray-200 text-2xl font-bold leading-none focus:outline-none"
            aria-label="Tutup modal"
          >
            &times;
          </button>
        </div>
        
        {/* Body Modal (Form) */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-md mb-4 border border-blue-100">
            Perbarui jumlah tiket di bawah ini. Total harga akan dikalkulasi ulang secara otomatis oleh sistem.
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
              disabled={isSaving || isDeleting}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border outline-none transition-colors disabled:bg-gray-100"
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
              disabled={isSaving || isDeleting}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border outline-none transition-colors disabled:bg-gray-100"
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
              disabled={isSaving || isDeleting}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border outline-none transition-colors disabled:bg-gray-100"
            />
          </div>

          {/* Footer Modal (Tombol Aksi) */}
          {/* Diubah menjadi flex-between agar tombol hapus ada di kiri dan aksi lain di kanan */}
          <div className="flex justify-between items-center pt-5 mt-2 border-t border-gray-100">
            
            {/* Tombol Hapus (Kiri) */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Menghapus..." : "Hapus Tiket"}
            </button>

            {/* Container Tombol Batal & Simpan (Kanan) */}
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={isSaving || isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              
              <button 
                type="submit" 
                disabled={isSaving || isDeleting} 
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-blue-400 flex items-center justify-center min-w-[140px]"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;