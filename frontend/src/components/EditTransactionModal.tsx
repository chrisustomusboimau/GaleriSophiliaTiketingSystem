/**
 * EditTransactionModal.tsx
 * ----------------------------------------------------
 * Komponen modal (popup) untuk mengedit, mengubah status,
 * dan menghapus transaksi tiket pengunjung.
 */

import React, { useState, useEffect } from 'react';

// Mendefinisikan tipe data yang dibutuhkan modal
export interface TransactionData {
  id: string;
  queue_number: number;
  under_8_count: number;
  under_22_count: number;
  adult_count: number;
  status: "pending" | "paid" | "cancelled" | string; // DITAMBAHKAN: Status
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
  // DITAMBAHKAN: status pada onSave
  onSave: (id: string, updatedData: { under_8_count: number; under_22_count: number; adult_count: number; status: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>; 
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ 
  isOpen, 
  onClose, 
  transaction, 
  onSave,
  onDelete 
}) => {
  // State untuk menyimpan data form yang sedang diedit
  const [formData, setFormData] = useState({
    under_8_count: 0,
    under_22_count: 0,
    adult_count: 0,
    status: "pending", // DITAMBAHKAN: State untuk status
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Efek ini berjalan setiap kali modal dibuka atau data transaksi yang dipilih berubah
  useEffect(() => {
    if (transaction) {
      setFormData({
        under_8_count: transaction.under_8_count,
        under_22_count: transaction.under_22_count,
        adult_count: transaction.adult_count,
        status: transaction.status, // Sinkronisasi status awal
      });
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Jika yang diubah adalah status (berupa string)
    if (name === "status") {
      setFormData((prev) => ({ ...prev, [name]: value }));
    } else {
      // Jika yang diubah adalah jumlah tiket (berupa angka)
      setFormData((prev) => ({ 
        ...prev, 
        [name]: Math.max(0, parseInt(value) || 0) 
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(transaction.id, formData);
      onClose(); 
    } catch (error) {
      console.error("Gagal menyimpan perubahan", error);
      alert("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus tiket Antrian #${transaction.queue_number}? Tindakan ini tidak dapat dibatalkan.`
    );
    
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(transaction.id);
      onClose(); 
    } catch (error) {
      console.error("Gagal menghapus tiket", error);
      alert("Gagal menghapus tiket. Silakan periksa koneksi Anda dan coba lagi.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        
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
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-md mb-4 border border-blue-100">
            Perbarui jumlah tiket dan status di bawah ini. Total harga akan dikalkulasi ulang secara otomatis.
          </div>

          {/* DITAMBAHKAN: Dropdown untuk mengubah Status Pembayaran */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status Pembayaran
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={isSaving || isDeleting}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2.5 border outline-none transition-colors disabled:bg-gray-100 font-medium"
            >
              <option value="pending">🟡 Menunggu (Pending)</option>
              <option value="paid">🟢 Lunas (Paid)</option>
              <option value="cancelled">🔴 Batal (Cancelled)</option>
            </select>
          </div>

          <div className="border-t border-gray-200 my-4 pt-4">
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
            
            <div className="mt-4">
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
            
            <div className="mt-4">
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
          </div>

          <div className="flex justify-between items-center pt-5 mt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Menghapus..." : "Hapus Tiket"}
            </button>

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
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;