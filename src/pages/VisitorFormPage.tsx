/**
 * VisitorFormPage.tsx
 * ----------------------------------------------------
 * Halaman untuk input data pengunjung (jumlah tiket dan asal negara).
 * Diperbarui dengan identitas visual Galeria Sophilia.
 */

import React from 'react';
import VisitorForm from '../components/VisitorForm';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/Header'; // <Header />

const VisitorFormPage: React.FC = () => {
  const { language, translations } = useLanguage();

  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      
      {/* HEADER: Galeria Sophilia Branding */}
      <Header />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col p-4 sm:p-8 justify-center items-center relative">
        
        {/* Dekorasi Background Tambahan (Gradient Halus untuk Kedalaman) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        {/* Form Container (Warna Putih #fcfcfc untuk Keterbacaan) */}
        <div className="w-full max-w-xl bg-[#fcfcfc] rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          
          {/* Judul Halaman di dalam Card */}
          <div className="p-6 sm:px-8 sm:pt-8 pb-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-black uppercase tracking-wide text-center">
              {translations.ticketingTitle[language]}
            </h2>
          </div>
          
          {/* Komponen Form Utama */}
          <div className="p-6 sm:p-8 bg-[#fcfcfc]">
            <VisitorForm />
          </div>
          
        </div>
      </main>

    </div>
  );
};

export default VisitorFormPage;