/**
 * ScanPage.tsx
 * ----------------------------------------------------
 * Halaman awal (Landing Page) aplikasi.
 * Diperbarui dengan identitas visual Galeria Sophilia.
 */

import React from 'react';
import LanguageSelector from '../components/LanguageSelector';
import Header from '../components/Header'; // <Header />

const ScanPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      
      {/* HEADER: Galeria Sophilia Branding */}
      <Header />
      
      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 relative">
        
        {/* Dekorasi Background Tambahan (Gradient Halus) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        {/* Container untuk Language Selector */}
        <div className="w-full max-w-sm bg-[#fcfcfc] rounded-2xl shadow-2xl p-8 sm:p-10 border border-gray-200 transform -translate-y-4">

          <LanguageSelector />
          
        </div>
      </main>
    </div>
  );
};

export default ScanPage;