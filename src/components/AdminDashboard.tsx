/**
 * AdminDashboard.tsx
 * ----------------------------------------------------
 * Cashier-facing panel to manage and confirm ticket payments.
 * Update: Menambahkan Popup Toast (Notifikasi melayang) untuk konfirmasi sukses.
 * Update: Menampilkan Metode Pembayaran (QRIS/Card) dengan jelas di kartu pengunjung.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../utils/priceCalculator";
import EditTransactionModal from "./EditTransactionModal"; 
import ManualEntryModal from "./ManualEntryModal";
import SuccessQueueModal from "./SuccessQueueModal";

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price: number;
}

export interface Visitor {
  id: string;
  queue_number: number;
  created_at: string;
  confirmed_at: string | null;
  total_price: number;
  status: "pending" | "paid" | "cancelled" | "confirmed";
  // TAMBAHAN: Field payment_method
  payment_method: string; 
  items: TransactionItem[];
}

interface VisitorCardProps {
  visitor: Visitor;
  isProcessing: boolean;
  onConfirmPayment: (id: string) => void;
  onEdit: (visitor: Visitor) => void; 
}

/* =====================================================
   SUB-COMPONENTS
===================================================== */

/** * Popup Toast Sederhana 
 * Muncul di tengah bawah layar dengan tema Sophilia (Hitam/Oranye)
 */
const Toast: React.FC<{ message: string; type: 'success' | 'error' }> = ({ message, type }) => (
  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-5 duration-300">
    <div className={`
      flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl border backdrop-blur-md
      ${type === 'success' 
        ? 'bg-black/90 text-[#fb9418] border-[#fb9418]' 
        : 'bg-red-600 text-white border-red-400'}
    `}>
      {type === 'success' ? (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className="font-bold tracking-wide text-sm whitespace-nowrap">{message}</span>
    </div>
  </div>
);

const VisitorCard: React.FC<VisitorCardProps> = ({
  visitor,
  isProcessing,
  onConfirmPayment,
  onEdit, 
}) => {
  
  const ageCategorySummary = useMemo(() => {
    const uniqueCounts: Record<string, number> = {
      adult: 0,
      student: 0,
      child: 0
    };

    const seenCategories = new Set<string>();

    for (const item of visitor.items) {
      const cat = item.age_category.toLowerCase();
      if (!seenCategories.has(cat)) {
        uniqueCounts[cat] = item.quantity;
        seenCategories.add(cat);
      }
    }

    return uniqueCounts;
  }, [visitor.items]);

  const groupedByFloor = useMemo(() => {
    return visitor.items.reduce((acc, item) => {
      if (!acc[item.floor]) acc[item.floor] = [];
      acc[item.floor].push(item);
      return acc;
    }, {} as Record<string, TransactionItem[]>);
  }, [visitor.items]);

  return (
    <div className="bg-[#fcfcfc] rounded-xl shadow-md overflow-hidden border border-gray-200 flex flex-col hover:shadow-lg transition-shadow">
      
      <header className="bg-black p-4 text-[#fcfcfc] flex justify-between items-center border-b-2 border-[#fb9418]">
        <div>
          <h4 className="font-extrabold text-xl leading-none text-[#fb9418]">
            #{visitor.queue_number}
          </h4>
          <span className="text-[10px] opacity-70 uppercase tracking-widest text-gray-300">Antrian</span>
        </div>
        <span className="text-xs bg-[#1a1a1a] border border-gray-800 px-2 py-1 rounded shadow-inner font-mono text-gray-300">
          {new Date(visitor.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </header>

      <div className="p-4 flex-1 flex flex-col bg-[#fcfcfc]">
        
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['adult', 'student', 'child'].map((cat) => (
            <div key={cat} className="bg-white border border-gray-200 rounded-lg p-2 text-center shadow-sm">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                {cat === 'child' ? 'Anak' : cat === 'student' ? 'Remaja' : 'Dewasa'}
              </span>
              <span className={`text-xl font-black ${ageCategorySummary[cat] > 0 ? 'text-[#fb9418]' : 'text-gray-300'}`}>
                {ageCategorySummary[cat]}
              </span>
            </div>
          ))}
        </div>

        <div className="flex-1 space-y-4 mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Rincian Tiket</p>
          
          {Object.entries(groupedByFloor).map(([floorName, items]) => (
            <div key={floorName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className={`px-3 py-1.5 text-xs font-bold border-b uppercase tracking-wide bg-gray-100 text-black`}>
                {floorName}
              </div>
              <div className="p-2 space-y-1.5">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[13px]">
                    <span className="text-black font-medium capitalize">
                      {item.age_category === 'child' ? 'Anak' : item.age_category === 'student' ? 'Remaja' : 'Dewasa'}
                    </span>
                    <div className="text-right">
                      <span className="text-gray-500 text-[11px] block leading-none">
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </span>
                      <span className="font-bold text-black">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {visitor.items.length === 0 && (
            <p className="text-gray-400 italic text-center py-4 text-sm bg-gray-50 rounded-lg border border-gray-200">Tidak ada tiket.</p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-300">
          <div className="flex justify-between items-end mb-5">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Total Tagihan</span>
              
              {/* TAMBAHAN: Menampilkan Badge Metode Pembayaran */}
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${
                visitor.payment_method === 'card' 
                  ? 'bg-gray-800 text-white border-gray-700' 
                  : 'bg-green-100 text-green-700 border-green-200'
              }`}>
                {visitor.payment_method === 'card' ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
                    Kartu Kredit/Debit
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    QRIS
                  </>
                )}
              </span>
            </div>
            
            <span className="text-2xl font-black text-black leading-none">
              {formatCurrency(visitor.total_price)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onEdit(visitor)}
              disabled={isProcessing}
              className="flex-1 py-3 px-2 rounded-xl font-bold text-sm transition-all border border-gray-300 text-black bg-white hover:bg-gray-100 active:scale-95 disabled:opacity-50 shadow-sm"
            >
              Edit
            </button>
            <button
              onClick={() => onConfirmPayment(visitor.id)}
              disabled={isProcessing}
              className="flex-[2] py-3 px-4 rounded-xl font-bold text-sm transition-all bg-[#fb9418] text-[#fcfcfc] hover:bg-orange-500 active:scale-95 shadow-md shadow-orange-200 disabled:bg-gray-300"
            >
              {isProcessing ? "Memproses..." : "Konfirmasi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =====================================================
   MAIN COMPONENT
===================================================== */

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>(""); 
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [successQueueNumber, setSuccessQueueNumber] = useState<number | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    const tokenType = localStorage.getItem("token_type") ?? "Bearer";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
    };
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadVisitors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/v1/transactions?status=pending", {
        method: "GET",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) { handleUnauthorized(); return; }
        throw new Error("Gagal mengambil data dari server.");
      }
      const data: Visitor[] = await response.json();
      setVisitors(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized]);

  const filteredVisitors = useMemo(() => {
    if (!searchQuery.trim()) return visitors;
    const query = searchQuery.trim();
    return visitors.filter((v) => v.queue_number.toString().includes(query));
  }, [visitors, searchQuery]);

  const handlePaymentConfirmation = async (id: string) => {
    try {
      setProcessingId(id);
      setError(null);
      const currentTx = visitors.find(v => v.id === id);

      const response = await fetch(`/api/v1/transactions/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "confirmed" }), 
      });

      if (!response.ok) {
        if (response.status === 401) { handleUnauthorized(); return; }
        throw new Error("Gagal mengonfirmasi transaksi.");
      }

      setVisitors((prev) => prev.filter((v) => v.id !== id));

      if (currentTx) {
        setSuccessMessage(`Antrian #${currentTx.queue_number} Berhasil Dikonfirmasi`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError("Gagal mengonfirmasi transaksi.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditClick = (visitor: Visitor) => {
    setSelectedVisitor(visitor);
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (id: string, updatedData: any) => {
    try {
      // Pastikan backend endpoints menerima properties ini
      if (updatedData.items || updatedData.origins || updatedData.payment_method) {
        const res = await fetch(`/api/v1/transactions/${id}/edit`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            items: updatedData.items, 
            origins: updatedData.origins,
            payment_method: updatedData.payment_method 
          }),
        });
        if (!res.ok) throw new Error("Gagal simpan rincian.");
      }
      if (updatedData.status) {
        await fetch(`/api/v1/transactions/${id}/status`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: updatedData.status }),
        });
      }
      setSuccessMessage("Perubahan Berhasil Disimpan");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadVisitors(); 
    } catch (error: any) {
      setError("Gagal menyimpan perubahan.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/transactions/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Gagal hapus data.");
      setVisitors((prev) => prev.filter((v) => v.id !== id));
      setSuccessMessage("Antrian Telah Dihapus");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError("Gagal menghapus data.");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleManualEntrySuccess = (newQueueNumber: number) => {
    setSuccessQueueNumber(newQueueNumber);
    setSuccessMessage(`Antrian #${newQueueNumber} Berhasil Dibuat`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCloseSuccessModal = () => {
    setSuccessQueueNumber(null);
    loadVisitors();
  };

  useEffect(() => {
    loadVisitors();
    const intervalId = setInterval(loadVisitors, 30_000);
    return () => clearInterval(intervalId);
  }, [loadVisitors]);

  return (
    <div className="w-full max-w-6xl mx-auto min-h-screen relative flex flex-col text-black">
      
      {/* AREA POPUP TOAST */}
      {successMessage && <Toast message={successMessage} type="success" />}
      {error && <Toast message={error} type="error" />}

      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-black uppercase tracking-tight">Antrian Aktif</h2>
          <p className="text-gray-500 text-sm mt-1">Dashboard Kasir Galeria Sophilia</p>
        </div>
      </header>

      <div className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-gray-200 pb-5">
        <h3 className="font-bold text-black text-lg whitespace-nowrap flex items-center gap-3">
          Menunggu Konfirmasi
          <span className="text-sm font-black text-[#fcfcfc] bg-[#fb9418] px-3 py-1 rounded-full shadow-sm">
            {filteredVisitors.length}
          </span>
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64 shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <input type="text" placeholder="Cari No. Antrian..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none text-sm transition-shadow bg-white" />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setIsManualEntryOpen(true)} className="flex-1 sm:flex-none text-sm font-bold px-4 py-2 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-900 transition-colors shadow-sm focus:ring-2 focus:ring-[#fb9418]">+ Tambah Manual</button>
            <button onClick={loadVisitors} disabled={isLoading} className="flex-1 sm:flex-none text-sm font-bold px-4 py-2 bg-white border border-gray-300 rounded-lg text-black hover:bg-gray-50 transition-colors shadow-sm">Refresh</button>
          </div>
        </div>
      </div>

      {visitors.length === 0 ? (
        <div className="flex-1 bg-white border border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center justify-center shadow-sm">
          <p className="text-gray-400 font-medium">Semua transaksi telah dikonfirmasi.</p>
        </div>
      ) : filteredVisitors.length === 0 ? (
        <div className="flex-1 bg-white border border-dashed border-gray-300 rounded-2xl p-12 flex items-center justify-center shadow-sm">
          <p className="text-gray-500 text-center">Antrian <span className="font-bold text-black">"{searchQuery}"</span> tidak ditemukan.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-12">
          {filteredVisitors.map((visitor) => (
            <VisitorCard key={visitor.id} visitor={visitor} isProcessing={processingId === visitor.id} onConfirmPayment={handlePaymentConfirmation} onEdit={handleEditClick} />
          ))}
        </div>
      )}

      <EditTransactionModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} transaction={selectedVisitor} onSave={handleSaveEdit} onDelete={handleDeleteTransaction} />
      <ManualEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} onSuccess={handleManualEntrySuccess} />
      <SuccessQueueModal isOpen={successQueueNumber !== null} queueNumber={successQueueNumber} onClose={handleCloseSuccessModal} />
    </div>
  );
};

export default AdminDashboard;