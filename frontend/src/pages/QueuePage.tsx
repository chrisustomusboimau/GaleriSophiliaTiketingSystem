/**
 * QueuePage.tsx
 * ----------------------------------------------------
 * Page component that displays the generated queue ticket for a visitor.
 * * Features:
 * - Fetches specific visitor data based on the URL parameter (ID/Queue Number).
 * - Handles loading, error, and "not found" states gracefully.
 * - Integrates with the FastAPI backend to retrieve real-time ticket data.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import QueueDisplay from '../components/QueueDisplay';

/* =====================================================
   TYPES
===================================================== */

// Matched to the new FastAPI TransactionResponse schema
export interface TransactionOrigin {
  country_code: string;
  count: number;
}

export interface Visitor {
  id: string;
  queue_number: number;
  under_8_count: number;
  under_22_count: number;
  adult_count: number;
  total_price: number;
  status: string;
  created_at: string; 
  origins: TransactionOrigin[]; 
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

const QueuePage: React.FC = () => {
  // --- Hooks ---
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // --- State ---
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  const loadVisitor = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch the specific transaction by its UUID
      const response = await fetch(`/api/v1/transactions/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Data pengunjung tidak ditemukan. Tiket mungkin sudah kedaluwarsa atau ID salah.");
        }
        throw new Error("Gagal memuat data dari server. Periksa koneksi internet Anda.");
      }

      const data: Visitor = await response.json();
      setVisitor(data);

    } catch (err: any) {
      console.error('Error loading visitor data:', err);
      setError(err.message || 'Gagal memuat data pengunjung.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // --- Effects ---
  useEffect(() => {
    loadVisitor();
  }, [loadVisitor]);

  // --- Render Helpers ---

  // Early return if URL is missing the ID parameter entirely
  if (!id) {
    return <Navigate to="/" replace />;
  }

  /**
   * Helper function to determine what the main body should render.
   * This replaces complex nested ternary operators for much better readability.
   */
  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 font-medium animate-pulse">Memuat tiket antrian...</p>
        </div>
      );
    }

    if (error || !visitor) {
      return (
        <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
          <div className="text-red-500 mb-4">
             {/* Simple warning SVG icon */}
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-800 text-lg font-bold mb-2">
            {error || 'Data pengunjung tidak ditemukan'}
          </p>
          <p className="text-gray-500 mb-8 text-sm">
            Nomor antrian yang Anda cari mungkin salah, sudah dihapus, atau sesi telah berakhir.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            Kembali ke Halaman Utama
          </button>
        </div>
      );
    }

    // Success State
    // Passing the fetched and typed visitor data down to the display component
    return <QueueDisplay visitor={visitor} />;
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Museum Ticketing</h1>
          <button 
            onClick={() => navigate('/')}
            className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
          >
            Beranda
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 md:p-8">
        {renderMainContent()}
      </main>
    </div>
  );
};

export default QueuePage;