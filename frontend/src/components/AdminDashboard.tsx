/**
 * AdminDashboard.tsx
 * ----------------------------------------------------
 * Cashier-facing panel to manage and confirm ticket payments.
 * Features:
 * - Fetches all pending visitors from the API.
 * - Auto-refreshes data periodically (polling).
 * - Sends PATCH requests to update payment status to 'paid'.
 * - Optimistically updates local state for immediate visual feedback.
 * - Opens an edit modal to modify ticket items, STATUS, and DELETE tickets.
 * - High-visibility summary grid for UNIQUE people counts.
 * - Sub-list grouped by floor.
 * - Handles Manual Entry and displays Success Queue Modal.
 * - SEARCH/FILTER based on queue number or transaction ID.
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
  total_price: number;
  status: "pending" | "paid" | "cancelled";
  items: TransactionItem[];
}

interface VisitorCardProps {
  visitor: Visitor;
  isProcessing: boolean;
  onConfirmPayment: (id: string) => void;
  onEdit: (visitor: Visitor) => void; 
}

/* =====================================================
   HELPERS
===================================================== */

/** Returns a specific color class based on floor name for better UI distinction */
const getFloorColorClass = (floor: string): string => {
  const f = floor.toLowerCase();
  if (f.includes("6") || f.includes("7")) return "bg-purple-100 text-purple-700 border-purple-200";
  if (f.includes("5")) return "bg-amber-100 text-amber-700 border-amber-200";
  if (f.includes("1")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

/* =====================================================
   SUB-COMPONENTS
===================================================== */

const VisitorCard: React.FC<VisitorCardProps> = ({
  visitor,
  isProcessing,
  onConfirmPayment,
  onEdit, 
}) => {
  
  // 1. Calculate the UNIQUE number of PEOPLE per age category for the summary
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

  // 2. Group items by floor dynamically for the breakdown
  const groupedByFloor = useMemo(() => {
    return visitor.items.reduce((acc, item) => {
      if (!acc[item.floor]) acc[item.floor] = [];
      acc[item.floor].push(item);
      return acc;
    }, {} as Record<string, TransactionItem[]>);
  }, [visitor.items]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 flex flex-col">
      <header className="bg-blue-600 p-4 text-white flex justify-between items-center">
        <div>
          <h4 className="font-bold text-lg leading-none">
            #{visitor.queue_number}
          </h4>
          <span className="text-[10px] opacity-80 uppercase tracking-widest">Antrian</span>
        </div>
        <span className="text-xs bg-blue-700 px-2 py-1 rounded shadow-inner font-mono">
          {new Date(visitor.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </header>

      <div className="p-4 flex-1 flex flex-col bg-slate-50/50">
        
        {/* --- HIGH-VISIBILITY SUMMARY SECTION (PEOPLE COUNT) --- */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['adult', 'student', 'child'].map((cat) => (
            <div key={cat} className="bg-white border rounded-lg p-2 text-center shadow-sm">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                {cat === 'child' ? 'Children' : cat + 's'}
              </span>
              <span className={`text-xl font-black ${ageCategorySummary[cat] > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                {ageCategorySummary[cat]}
              </span>
            </div>
          ))}
        </div>

        {/* --- DETAILED FLOOR BREAKDOWN --- */}
        <div className="flex-1 space-y-4 mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Detail Per Lantai</p>
          
          {Object.entries(groupedByFloor).map(([floorName, items]) => (
            <div key={floorName} className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <div className={`px-3 py-1.5 text-xs font-bold border-b ${getFloorColorClass(floorName)}`}>
                {floorName}
              </div>
              <div className="p-2 space-y-1.5">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-700 capitalize">
                      {item.age_category}
                    </span>
                    <div className="text-right">
                      <span className="text-gray-400 text-[11px] block leading-none">
                        {item.quantity} x {formatCurrency(item.unit_price)}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {visitor.items.length === 0 && (
            <p className="text-gray-400 italic text-center py-4 text-sm">Tidak ada tiket.</p>
          )}
        </div>

        {/* --- TOTALS & ACTIONS --- */}
        <div className="pt-3 border-t border-dashed border-gray-300">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Tagihan</span>
            <span className="text-xl font-black text-blue-700">
              {formatCurrency(visitor.total_price)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onEdit(visitor)}
              disabled={isProcessing}
              className="flex-1 py-2.5 px-2 rounded-lg font-bold text-sm transition-all border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 active:scale-95 disabled:opacity-50"
            >
              Ubah Tiket
            </button>
            <button
              onClick={() => onConfirmPayment(visitor.id)}
              disabled={isProcessing}
              className="flex-[2] py-2.5 px-4 rounded-lg font-bold text-sm transition-all bg-green-600 text-white hover:bg-green-700 active:scale-95 shadow-lg shadow-green-200 disabled:bg-gray-300"
            >
              {isProcessing ? "Memproses..." : "Bayar Lunas"}
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

  // --- State ---
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>(""); // State untuk pencarian
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // --- Modal States ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [successQueueNumber, setSuccessQueueNumber] = useState<number | null>(null);

  // --- Helpers ---
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

  // --- Data Fetching ---
  const loadVisitors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/v1/transactions?status=pending", {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        throw new Error("Gagal mengambil data dari server.");
      }

      const data: Visitor[] = await response.json();
      setVisitors(data);

    } catch (err: any) {
      console.error("Error loading visitors:", err);
      setError(err.message || "Gagal memuat data pengunjung. Periksa koneksi Anda.");
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized]);

// --- Derived State (Filter Pencarian KHUSUS NOMOR ANTRIAN) ---
  const filteredVisitors = useMemo(() => {
    if (!searchQuery.trim()) return visitors;
    
    // Hapus spasi dan pastikan formatnya string untuk dicocokkan
    const query = searchQuery.trim();
    
    return visitors.filter((v) =>
      // Hanya mencocokkan string nomor antrian
      v.queue_number.toString().includes(query)
    );
  }, [visitors, searchQuery]);

  // --- Handlers ---
  const handlePaymentConfirmation = async (id: string) => {
    try {
      setProcessingId(id);
      setError(null);

      const response = await fetch(`/api/v1/transactions/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "paid" }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        let errorMessage = "Gagal memperbarui status pembayaran.";
        try {
          const errData = await response.json();
          if (errData.detail) errorMessage = errData.detail;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      setVisitors((prev) => prev.filter((v) => v.id !== id));

    } catch (err: any) {
      console.error("Error confirming payment:", err);
      setError(err.message || "Gagal memperbarui status pembayaran. Silakan coba lagi.");
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
      if (updatedData.items) {
        const responseEdit = await fetch(`/api/v1/transactions/${id}/edit`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            items: updatedData.items 
          }),
        });

        if (!responseEdit.ok) {
          if (responseEdit.status === 401) {
            handleUnauthorized();
            return;
          }
          throw new Error("Gagal menyimpan jumlah tiket.");
        }
      }

      if (updatedData.status) {
        const responseStatus = await fetch(`/api/v1/transactions/${id}/status`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: updatedData.status }),
        });

        if (!responseStatus.ok) {
          if (responseStatus.status === 401) {
            handleUnauthorized();
            return;
          }
          throw new Error("Gagal menyimpan status tiket.");
        }
      }

      await loadVisitors();
      
    } catch (error) {
      console.error(error);
      throw error; 
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const response = await fetch(`/api/v1/transactions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
      }
      throw new Error("Gagal menghapus data.");
    }

    setVisitors((prev) => prev.filter((v) => v.id !== id));
  };

  // --- Manual Entry Specific Handlers ---
  const handleManualEntrySuccess = (newQueueNumber: number) => {
    setSuccessQueueNumber(newQueueNumber);
  };

  const handleCloseSuccessModal = () => {
    setSuccessQueueNumber(null);
    loadVisitors();
  };

  // --- Effects ---
  useEffect(() => {
    loadVisitors();
    const intervalId = setInterval(loadVisitors, 30_000);
    return () => clearInterval(intervalId);
  }, [loadVisitors]);

  // --- Render ---
  return (
    <div className="w-full max-w-6xl mx-auto p-4 min-h-screen relative flex flex-col">
      
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Dashboard Kasir</h2>
          <p className="text-gray-600">Kelola antrian dan pembayaran tiket pengunjung</p>
        </div>
      </header>

      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b pb-4">
        <h3 className="font-medium text-gray-700 text-lg whitespace-nowrap">
          Pengunjung Menunggu:{" "}
          <span className="font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full ml-1">
            {filteredVisitors.length}
          </span>
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Kolom Pencarian */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari No. Antrian"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-shadow"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsManualEntryOpen(true)}
              className="flex-1 sm:flex-none text-sm font-bold px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 shadow-sm transition-colors focus:ring-2 focus:ring-emerald-500"
            >
              + Tambah Manual
            </button>
            
            <button
              onClick={loadVisitors}
              disabled={isLoading}
              className="flex-1 sm:flex-none text-sm font-medium px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isLoading ? "Memuat..." : "Segarkan"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md shadow-sm">
          <p>{error}</p>
        </div>
      )}

      {visitors.length === 0 ? (
        <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 flex items-center justify-center">
          <p className="text-gray-500 text-lg text-center">
            {isLoading
              ? "Mengambil data pengunjung dari server..."
              : "Tidak ada pengunjung yang sedang menunggu pembayaran."}
          </p>
        </div>
      ) : filteredVisitors.length === 0 ? (
        <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 flex items-center justify-center">
          <p className="text-gray-500 text-lg text-center">
            Pencarian untuk <span className="font-bold text-gray-700">"{searchQuery}"</span> tidak ditemukan.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-12">
          {filteredVisitors.map((visitor) => (
            <VisitorCard
              key={visitor.id}
              visitor={visitor}
              isProcessing={processingId === visitor.id}
              onConfirmPayment={handlePaymentConfirmation}
              onEdit={handleEditClick} 
            />
          ))}
        </div>
      )}

      {/* =========================================================
          MODALS AREA 
      ========================================================= */}
      
      <EditTransactionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        transaction={selectedVisitor}
        onSave={handleSaveEdit}
        onDelete={handleDeleteTransaction} 
      />

      <ManualEntryModal 
        isOpen={isManualEntryOpen} 
        onClose={() => setIsManualEntryOpen(false)} 
        onSuccess={handleManualEntrySuccess} 
      />

      <SuccessQueueModal 
        isOpen={successQueueNumber !== null} 
        queueNumber={successQueueNumber} 
        onClose={handleCloseSuccessModal} 
      />

    </div>
  );
};

export default AdminDashboard;