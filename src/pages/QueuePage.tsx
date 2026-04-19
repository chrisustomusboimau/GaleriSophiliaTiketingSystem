/**
 * QueuePage.tsx
 * ----------------------------------------------------
 * Page component that displays the generated queue ticket for a visitor.
 * Diperbarui dengan identitas visual Galeria Sophilia dan dukungan confirmed_at.
 * Update: Terintegrasi penuh dengan LanguageContext untuk dukungan multibahasa.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import QueueDisplay from '../components/QueueDisplay';
import { useLanguage } from '../contexts/LanguageContext';

/* =====================================================
   TYPES
===================================================== */

export interface TransactionOrigin {
  country_code: string;
  count: number;
}

export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price: number;
}

export interface Visitor {
  id: string;
  queue_number: number;
  total_price: number;
  status: string;
  created_at: string; 
  confirmed_at: string | null; 
  items: TransactionItem[];    
  origins: TransactionOrigin[]; 
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

const QueuePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, translations } = useLanguage();

  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadVisitor = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/transactions/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(translations.visitorNotFoundDetail[language]);
        }
        throw new Error(translations.fetchDataError[language]);
      }

      const data: Visitor = await response.json();
      setVisitor(data);

    } catch (err: any) {
      console.error('Error loading visitor data:', err);
      setError(err.message || translations.loadVisitorError[language]);
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
          {/* Spinner Oranye */}
          <div className="w-12 h-12 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium animate-pulse tracking-wide uppercase text-sm">
            {translations.loadingQueueTicket[language]}
          </p>
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
          <p className="text-black text-xl font-bold mb-3">
            {error || translations.visitorNotFoundTitle[language]}
          </p>
          <p className="text-gray-600 mb-8 text-sm leading-relaxed">
            {translations.queueNumberInvalid[language]}
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-4 bg-[#fb9418] text-[#fcfcfc] rounded-xl hover:bg-orange-500 transition-all active:scale-95 font-bold shadow-md"
          >
            {translations.backToHomeButton[language]}
          </button>
        </div>
      );
    }

    // Success State
    return <QueueDisplay visitor={visitor} />;
  };

  return (
    // bg-black digunakan di sini agar overscroll menampilkan warna hitam
    <div className="min-h-screen bg-black flex flex-col font-sans">
      
      {/* HEADER: Galeria Sophilia Branding */}
      <header className="bg-black py-6 px-4 flex items-center justify-center border-b border-white/10 shrink-0 relative z-10">
        
        {/* Tombol Back / Home diletakkan di sudut kiri agar tidak mengganggu logo */}
        <button 
          onClick={() => navigate('/')}
          className="absolute left-4 sm:left-6 text-gray-400 hover:text-[#fb9418] transition-colors p-2 focus:outline-none"
          aria-label={translations.backToHomeAria[language]}
        >
          <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="text-center select-none pt-1">
          <h2 className="text-[#fcfcfc] font-light tracking-[0.4em] text-xs md:text-sm uppercase ml-1">
            Galeria
          </h2>
          <h1 className="text-[#fb9418] font-bold tracking-wider text-2xl md:text-3xl mt-1 uppercase leading-none">
            Sophilia
          </h1>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="bg-[#fcfcfc] flex-1 flex flex-col p-4 md:p-8 items-center justify-center relative">
        {/* Latar belakang gradient hitam ke abu-abu gelap */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />
        {renderMainContent()}
      </main>
      
    </div>
  );
};

export default QueuePage;