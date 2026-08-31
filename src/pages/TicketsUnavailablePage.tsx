/**
 * TicketsUnavailablePage.tsx — BARU
 * ----------------------------------------------------
 * Halaman tujuan pengunjung ketika TIDAK ADA sesi penjualan yang sedang
 * berjalan. Dicapai lewat dua jalan:
 *
 *   1) `RequireActiveSession` mengalihkan ke sini saat pengunjung mencoba
 *      membuka `/ticket-selection` atau `/visitor-form` di luar jam sesi.
 *   2) `VisitorForm` mengalihkan ke sini kalau `POST /transactions` ditolak
 *      403 — yaitu ketika sesi keburu berakhir selagi pengunjung mengisi
 *      formulir.
 *
 * Teks permintaan maafnya ditampilkan dalam BAHASA AKTIF pengunjung saja
 * (bukan dua bahasa bertumpuk), konsisten dengan seluruh layar publik lain.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useActiveSession } from "../contexts/ActiveSessionContext";
import Header from "../components/Header";

const TicketsUnavailablePage: React.FC = () => {
  const navigate = useNavigate();
  const { language, translations } = useLanguage();
  const { reload } = useActiveSession();
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Sesi berikutnya bisa dibuka admin kapan saja selagi pengunjung berdiri
   * di halaman ini — tombol ini menanyakan ulang ke server, dan kalau sudah
   * ada sesi berjalan, langsung mengantar ke pemilihan tiket.
   */
  const handleCheckAgain = async () => {
    setIsChecking(true);
    try {
      const nowActive = await reload();
      if (nowActive) navigate("/ticket-selection", { replace: true });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative font-sans">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        <div className="w-full max-w-lg bg-[#fcfcfc] rounded-2xl shadow-2xl p-8 sm:p-10 border border-gray-200 text-center">
          {/* Ikon informasi — nada netral & informatif, bukan nada error:
              galeri sedang tutup adalah keadaan normal, bukan kesalahan
              yang dibuat pengunjung. */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-orange-50 border-2 border-[#fb9418] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#fb9418]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-black uppercase tracking-wide mb-4">
            {translations.ticketsUnavailableTitle[language]}
          </h2>

          <p className="text-gray-600 text-base leading-relaxed mb-8">
            {translations.ticketsUnavailableMessage[language]}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate("/", { replace: true })}
              className="flex-1 py-4 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all duration-200 active:scale-95"
            >
              {translations.backToHomeButton[language]}
            </button>

            <button
              onClick={handleCheckAgain}
              disabled={isChecking}
              className="flex-1 py-4 font-bold text-[#fcfcfc] bg-[#fb9418] hover:bg-orange-500 rounded-xl transition-all duration-200 shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking ? translations.checkingSession[language] : translations.checkAgainButton[language]}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TicketsUnavailablePage;
