/**
 * ScanPage.tsx
 * ----------------------------------------------------
 * Halaman awal (Landing Page) aplikasi.
 * Diperbarui dengan identitas visual Galeria Sophilia.
 */

import React from 'react';
import LanguageSelector from '../components/LanguageSelector';

const ScanPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col font-sans">
      
      {/* HEADER: Galeria Sophilia Branding */}
      <header className="bg-black pt-16 pb-8 px-4 flex flex-col items-center justify-center shrink-0 z-10">
        <div className="text-center select-none">
          <h2 className="text-[#fcfcfc] font-light tracking-[0.5em] text-base md:text-lg uppercase ml-2">
            Galeria
          </h2>
          <h1 className="text-[#fb9418] font-bold tracking-wider text-5xl md:text-6xl mt-2 uppercase">
            Sophilia
          </h1>
        </div>
      </header>
      
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