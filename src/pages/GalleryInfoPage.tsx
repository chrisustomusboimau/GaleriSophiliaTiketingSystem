/**
 * GalleryInfoPage.tsx
 * ----------------------------------------------------
 * Halaman informasi eksibisi yang muncul sebelum pemilihan lantai.
 * Desain: Header terpisah di atas latar hitam (menyamai TicketSelectionPage),
 * dengan konten di dalam kanvas putih (content container).
 * Update: Implementasi LanguageContext untuk dukungan Multibahasa.
 * Update 2: Typography Futura, no italic, unified floor container,
 *           lowercase bold floor labels, regular weight descriptions,
 *           center-aligned floor content. No dividers between floors.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import Header from '../components/Header';

const futuraFont: React.CSSProperties = {
  fontFamily: "'Futura', 'Century Gothic', 'Trebuchet MS', sans-serif",
};

const GalleryInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, translations } = useLanguage();

  // ==========================================
  // LOGIKA AUTO-REDIRECT TIKET AKTIF
  // ==========================================
  useEffect(() => {
    const cachedQueue = localStorage.getItem("sophilia_active_queue");
    if (cachedQueue) {
      try {
        const parsed = JSON.parse(cachedQueue);
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        if (now - parsed.timestamp < tenMinutes) {
          navigate(`/queue/${parsed.id}`, { state: parsed.state, replace: true });
        } else {
          localStorage.removeItem("sophilia_active_queue");
        }
      } catch (e) {
        localStorage.removeItem("sophilia_active_queue");
      }
    }
  }, [navigate]);

  return (
    <div
      className="min-h-screen bg-black flex flex-col relative selection:bg-orange-200"
      style={futuraFont}
    >
      {/* HEADER */}
      <Header />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col items-center p-4 sm:p-8 relative">

        {/* Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        {/* CONTENT CONTAINER (White Canvas) */}
        <div className="w-full max-w-2xl bg-[#fcfcfc] rounded-2xl shadow-2xl p-6 sm:p-8 border-2 border-[#fb9418] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">

          <div className="flex flex-col gap-1">

            {/* Bagian Pembuka */}
            <div className="text-center pb-2">
              <p className="font-extrabold text-black text-xl sm:text-2xl mb-2">
                {translations.galleryOpenTime[language]}
              </p>
              <p className="text-gray-700 font-medium text-base sm:text-lg">
                {translations.culturalExperience[language]}
              </p>
              <p className="text-gray-400 text-sm mt-1">
                {translations.seeBannerInfo[language]}
              </p>
            </div>

            {/* Daftar Lantai — Unified Container, No Dividers */}
            <div className="border border-gray-200 rounded-xl p-5 text-center flex flex-col gap-4">

              {/* Lantai 1 */}
              <div>
                <p className="text-sm font-bold text-black tracking-wide mb-1">
                  {translations.floor1[language]}
                </p>
                <p className="text-base font-normal text-black leading-snug">
                  {translations.floor1Desc[language]}
                </p>
              </div>

              {/* Lantai 5 */}
              <div>
                <p className="text-sm font-bold text-black tracking-wide mb-1">
                  {translations.floor5[language]}
                </p>
                <p className="text-base font-normal text-black leading-snug">
                  {translations.floor5DescPart1[language]}{' '}
                  {translations.floor5DescPart2[language]}
                </p>
              </div>

              {/* Lantai 6–7 */}
              <div>
                <p className="text-sm font-bold text-black tracking-wide mb-1">
                  {translations.floor67[language]}
                </p>
                <p className="text-base font-normal text-black leading-snug">
                  {translations.floor67Desc[language]}
                </p>
              </div>

            </div>

            {/* Penutup (Call to Action) */}
            <div className="bg-white p-6 rounded-xl text-center mt-2">
              <p className="font-normal text-black mb-2 text-base sm:text-lg">
                {translations.pleaseSelectTicket[language]}
              </p>
              <p className="font-normal text-black mb-2 text-base sm:text-lg">
                {translations.forOneTwoOrAll[language]}
              </p>
              <p className="font-normal text-black mb-2 text-base sm:text-lg">
                {translations.enjoyCulturalJourney[language]}
              </p>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-2">
              <button
                onClick={() => navigate('/ticket-selection')}
                className="w-full py-4 font-bold text-[#fcfcfc] bg-[#fb9418] hover:bg-orange-500 rounded-xl transition-all duration-200 shadow-md flex justify-center items-center gap-2 active:scale-95 uppercase tracking-wide"
                style={futuraFont}
              >
                {translations.continueButton2[language]}
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default GalleryInfoPage;