/**
 * QueuePage.tsx
 * ----------------------------------------------------
 * Menampilkan tiket antrian yang baru dibuat untuk pengunjung.
 *
 * UPDATE (selaras backend baru): tipe `Visitor` lokal yang lama
 * (floor/age_category, tanpa customer_name) diganti memakai
 * `TransactionEntry` sungguhan dari `src/types`. Pemanggilan API juga
 * dipindah ke `api/client.ts` (apiGet) supaya konsisten dengan seluruh
 * aplikasi — endpoint ini publik jadi `skipAuthRedirect: true`.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import QueueDisplay from "../components/QueueDisplay";
import { useLanguage } from "../contexts/LanguageContext";
import { apiGet, ApiError } from "../api/client";
import { TransactionEntry } from "../types";
import Header from "../components/Header";

const QueuePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, translations } = useLanguage();

  const [visitor, setVisitor] = useState<TransactionEntry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadVisitor = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<TransactionEntry>(`/transactions/${id}`, { skipAuthRedirect: true });
      setVisitor(data);
    } catch (err) {
      console.error("Error loading visitor data:", err);
      if (err instanceof ApiError && err.status === 404) {
        setError(translations.visitorNotFoundDetail[language]);
      } else {
        setError(translations.fetchDataError[language]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, language, translations]);

  useEffect(() => {
    loadVisitor();
  }, [loadVisitor]);

  if (!id) {
    return <Navigate to="/" replace />;
  }

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-5">
          <div className="w-12 h-12 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium animate-pulse tracking-wide uppercase text-sm">{translations.loadingQueueTicket[language]}</p>
        </div>
      );
    }

    if (error || !visitor) {
      return (
        <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl p-8 sm:p-10 text-center border border-gray-200 transform transition-all">
          <div className="text-red-500 mb-5">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-black text-xl font-bold mb-3">{error || translations.visitorNotFoundTitle[language]}</p>
          <p className="text-gray-600 mb-8 text-sm leading-relaxed">{translations.queueNumberInvalid[language]}</p>
          <button
            onClick={() => navigate("/")}
            className="w-full px-6 py-4 bg-[#fb9418] text-[#fcfcfc] rounded-xl hover:bg-orange-500 transition-all active:scale-95 font-bold shadow-md"
          >
            {translations.backToHomeButton[language]}
          </button>
        </div>
      );
    }

    return <QueueDisplay visitor={visitor} />;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      <header className="bg-black py-6 px-4 flex items-center justify-center border-b border-white/10 shrink-0 relative z-10">
        <button
          onClick={() => navigate("/")}
          className="absolute left-4 sm:left-6 text-gray-400 hover:text-[#fb9418] transition-colors p-2 focus:outline-none"
          aria-label={translations.backToHomeAria[language]}
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <Header />
      </header>

      <main className="bg-[#fcfcfc] flex-1 flex flex-col p-4 md:p-8 items-center justify-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />
        {renderMainContent()}
      </main>
    </div>
  );
};

export default QueuePage;
