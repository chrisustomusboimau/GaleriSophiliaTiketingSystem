/**
 * GalleryInfoPage.tsx
 * ----------------------------------------------------
 * Halaman informasi eksibisi yang muncul sebelum pemilihan lantai.
 * Updated: Penutup CTA digabung dalam satu blok dengan line-height rapat (leading-tight).
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
      <header className="w-full py-6 flex justify-center items-center">
        <Header />
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col items-center p-2 sm:p-4 relative">

        {/* Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        {/* CONTENT CONTAINER (White Canvas) */}
        <div className="w-full max-w-3xl bg-[#fcfcfc] rounded-2xl shadow-2xl px-4 sm:px-8 py-6 border-2 border-[#fb9418] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">

          <div className="flex flex-col gap-2">

            {/* Bagian Pembuka */}
            <div className="text-center pb-3 text-black text-base sm:text-[17px] leading-snug">
              <p dangerouslySetInnerHTML={{ __html: translations.galleryOpenTime[language] }} />
              <p className="whitespace-nowrap sm:whitespace-normal">
                {translations.culturalExperience[language]}
              </p>
              <p>
                {translations.seeBannerInfo[language]}
              </p>
            </div>

            {/* Daftar Lantai — Unified Container */}
            <div className="border border-gray-200 rounded-xl px-3 sm:px-6 py-5 text-center flex flex-col gap-4">

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

            {/* Penutup (Call to Action) — Digabung dan Dirapatkan */}
            <div className="bg-white p-3 text-center mt-1">
              <p className="font-normal text-black text-base sm:text-lg leading-tight">
                {translations.pleaseSelectTicket[language]}<br />
                {translations.forOneTwoOrAll[language]}<br />
                {translations.enjoyCulturalJourney[language]}
              </p>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-2">
              <button
                onClick={() => navigate('/ticket-selection')}
                className="w-full py-4 font-bold text-[#fcfcfc] bg-[#fb9418] hover:bg-orange-500 rounded-xl transition-all duration-200 shadow-md flex justify-center items-center gap-2 active:scale-95 uppercase tracking-wide text-sm sm:text-base"
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