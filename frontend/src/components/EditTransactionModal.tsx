/**
 * EditTransactionModal.tsx
 * ----------------------------------------------------
 * Komponen modal (popup) untuk mengedit, mengubah status,
 * dan menghapus transaksi tiket pengunjung.
 * Diperbarui untuk mendukung skema array 'items' (dinamis per lantai).
 */

import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency } from "../utils/priceCalculator";

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price: number;
}

export interface TransactionData {
  id: string;
  queue_number: number;
  status: "pending" | "paid" | "cancelled" | string;
  total_price: number;
  items: TransactionItem[];
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
  onSave: (id: string, updatedData: { items?: TransactionItem[]; status?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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
  const [editedItems, setEditedItems] = useState<TransactionItem[]>([]);
  const [editedStatus, setEditedStatus] = useState<string>("pending");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when the modal opens or transaction changes
  useEffect(() => {
    if (transaction && isOpen) {
      // Deep copy the items so we don't accidentally mutate the dashboard's state directly
      setEditedItems(JSON.parse(JSON.stringify(transaction.items || [])));
      setEditedStatus(transaction.status);
      setError(null);
    }
  }, [transaction, isOpen]);

  // Dynamically calculate the new total price based on edits
  const newTotalPrice = useMemo(() => {
    return editedItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
  }, [editedItems]);

  // --- Handlers ---
  const handleQuantityChange = (index: number, newQty: number) => {
    setEditedItems((prev) => {
      const updated = [...prev];
      updated[index].quantity = Math.max(0, newQty); // Prevent negative numbers
      return updated;
    });
  };

  const handleSave = async () => {
    if (!transaction) return;
    
    // Validate: Don't allow saving if total tickets is 0
    const totalTickets = editedItems.reduce((sum, item) => sum + item.quantity, 0);
    if (totalTickets === 0 && editedStatus !== "cancelled") {
      setError("Jumlah total tiket tidak boleh 0. Hapus transaksi atau ubah status ke Cancelled.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave(transaction.id, {
        items: editedItems,
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <header className="bg-slate-50 border-b p-5 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Edit Transaksi</h3>
            <p className="text-sm text-gray-500">Antrian: <span className="font-bold text-gray-800">{transaction.queue_number}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-xl px-2"
          >
            ✕
          </button>
        </header>

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">
              {error}
            </div>
          )}

          {/* STATUS DROPDOWN */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Status Pembayaran
            </label>
            <select
              value={editedStatus}
              onChange={(e) => setEditedStatus(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="pending">🟡 Menunggu (Pending)</option>
              <option value="paid">🟢 Lunas (Paid)</option>
              <option value="cancelled">🔴 Batal (Cancelled)</option>
            </select>
          </div>

          {/* DYNAMIC ITEMS LIST */}
          <div className="mb-2">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Detail Tiket
            </label>
            <div className="space-y-3">
              {editedItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-slate-50">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 capitalize">
                      {item.age_category} <span className="text-xs font-normal text-gray-500">({item.floor})</span>
                    </p>
                    <p className="text-sm text-gray-500">{formatCurrency(item.unit_price)}</p>
                  </div>
                  
                  {/* QUANTITY CONTROLS */}
                  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                    <button
                      onClick={() => handleQuantityChange(idx, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      disabled={item.quantity === 0}
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-gray-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(idx, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {editedItems.length === 0 && (
                <p className="text-gray-500 italic text-sm py-2">Tidak ada data tiket.</p>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER & TOTALS */}
        <div className="bg-slate-50 border-t p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-medium">Total Harga Baru:</span>
            <span className={`text-xl font-bold ${newTotalPrice !== transaction.total_price ? 'text-blue-700' : 'text-gray-800'}`}>
              {formatCurrency(newTotalPrice)}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </button>
            <div className="flex-1 flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isDeleting}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
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