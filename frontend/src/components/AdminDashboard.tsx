/**
 * AdminDashboard.tsx
 * ----------------------------------------------------
 * Cashier-facing panel to manage and confirm ticket payments.
 * Features:
 * - Fetches all pending visitors from the API.
 * - Auto-refreshes data periodically (polling).
 * - Sends PATCH requests to update payment status to 'paid'.
 * - Optimistically updates local state for immediate visual feedback.
 * - Opens an edit modal to modify ticket counts and DELETE tickets.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, PRICES } from "../utils/priceCalculator";
import EditTransactionModal from "./EditTransactionModal"; // DITAMBAHKAN: Import Modal

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface Visitor {
  id: string;
  queue_number: number;
  created_at: string;
  under_8_count: number;
  under_22_count: number;
  adult_count: number;
  total_price: number;
  status: "pending" | "paid" | "cancelled";
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

const VisitorCard: React.FC<VisitorCardProps> = ({
  visitor,
  isProcessing,
  onConfirmPayment,
  onEdit, 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 flex flex-col">
      <header className="bg-blue-600 p-4 text-white flex justify-between items-center">
        <h4 className="font-bold text-lg">
          Nomor Antrian: {visitor.queue_number}
        </h4>
        <span className="text-xs bg-blue-500 px-2 py-1 rounded shadow-inner">
          {new Date(visitor.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </header>

      <div className="p-4 flex-1 flex flex-col">
        <div className="space-y-2 text-sm flex-1 mb-4">
          {visitor.under_8_count > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Anak (&lt; 8 thn):</span>
              <span className="font-medium">
                {visitor.under_8_count} × {formatCurrency(PRICES.UNDER_8)} ={" "}
                {formatCurrency(visitor.under_8_count * PRICES.UNDER_8)}
              </span>
            </div>
          )}

          {visitor.under_22_count > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Remaja (&lt; 22 thn):</span>
              <span className="font-medium">
                {visitor.under_22_count} × {formatCurrency(PRICES.UNDER_22)} ={" "}
                {formatCurrency(visitor.under_22_count * PRICES.UNDER_22)}
              </span>
            </div>
          )}

          {visitor.adult_count > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Dewasa (22+ thn):</span>
              <span className="font-medium">
                {visitor.adult_count} × {formatCurrency(PRICES.ADULT)} ={" "}
                {formatCurrency(visitor.adult_count * PRICES.ADULT)}
              </span>
            </div>
          )}

          <div className="flex justify-between pt-3 border-t border-gray-200 mt-3 text-base font-bold">
            <span>Total:</span>
            <span className="text-blue-700">
              {formatCurrency(visitor.total_price)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onEdit(visitor)}
            disabled={isProcessing}
            className={`w-1/3 py-2 px-2 rounded font-medium transition-colors duration-200 border border-gray-300 text-gray-700 ${
              isProcessing
                ? "bg-gray-100 cursor-not-allowed opacity-50"
                : "bg-white hover:bg-gray-50 shadow-sm"
            }`}
          >
            Edit
          </button>
          <button
            onClick={() => onConfirmPayment(visitor.id)}
            disabled={isProcessing}
            className={`w-2/3 py-2 px-4 rounded font-medium transition-colors duration-200 ${
              isProcessing
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
            }`}
            aria-busy={isProcessing}
          >
            {isProcessing ? "Memproses..." : "Konfirmasi"}
          </button>
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);

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
    setIsModalOpen(true);
  };

  const handleSaveEdit = async (id: string, updatedData: any) => {
    const response = await fetch(`/api/v1/transactions/${id}/edit`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(updatedData),
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
      }
      throw new Error("Gagal menyimpan data.");
    }

    await loadVisitors();
  };

  // ==========================================
  // FUNGSI DELETE (DITAMBAHKAN)
  // ==========================================
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

    // Perbarui state secara lokal untuk umpan balik yang lebih cepat (menghapus kartu)
    setVisitors((prev) => prev.filter((v) => v.id !== id));
  };

  // --- Effects ---
  useEffect(() => {
    loadVisitors();
    const intervalId = setInterval(loadVisitors, 30_000);
    return () => clearInterval(intervalId);
  }, [loadVisitors]);

  // --- Render ---
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Kasir</h2>
        <p className="text-gray-600">Kelola antrian dan pembayaran tiket pengunjung</p>
      </header>

      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b pb-4">
        <h3 className="font-medium text-gray-700 text-lg">
          Pengunjung Menunggu:{" "}
          <span className="font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full ml-2">
            {visitors.length}
          </span>
        </h3>

        <button
          onClick={loadVisitors}
          disabled={isLoading}
          className="text-sm font-medium px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Memuat ulang..." : "Segarkan Data"}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md shadow-sm">
          <p>{error}</p>
        </div>
      )}

      {visitors.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg">
            {isLoading
              ? "Mengambil data pengunjung dari server..."
              : "Tidak ada pengunjung yang sedang menunggu pembayaran."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visitors.map((visitor) => (
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

      {/* PROP onDelete DITAMBAHKAN KE SINI */}
      <EditTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedVisitor}
        onSave={handleSaveEdit}
        onDelete={handleDeleteTransaction} 
      />
    </div>
  );
};

export default AdminDashboard;