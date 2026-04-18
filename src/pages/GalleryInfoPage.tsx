/**
 * GalleryInfoPage.tsx
 * ----------------------------------------------------
 * Halaman informasi eksibisi yang muncul sebelum pemilihan lantai.
 * Desain: Header terpisah di atas latar hitam (menyamai TicketSelectionPage),
 * dengan konten di dalam kanvas putih (content container).
 * Update: Menambahkan Auto-Redirect jika pengguna sudah memiliki antrian aktif.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GalleryInfoPage: React.FC = () => {
  const navigate = useNavigate();

  // ==========================================
  // LOGIKA AUTO-REDIRECT TIKET AKTIF
  // ==========================================
  useEffect(() => {
    const cachedQueue = localStorage.getItem("sophilia_active_queue");
    if (cachedQueue) {
      try {
        const parsed = JSON.parse(cachedQueue);
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000; // 10 menit dalam milidetik

        if (now - parsed.timestamp < tenMinutes) {
          // Tiket masih aktif, langsung redirect ke halaman antrian
          navigate(`/queue/${parsed.id}`, { state: parsed.state, replace: true });
        } else {
          // Sudah lewat 10 menit, hapus kunci dari memory agar bisa buat baru
          localStorage.removeItem("sophilia_active_queue");
        }
      } catch (e) {
        // Jika format data rusak, bersihkan
        localStorage.removeItem("sophilia_active_queue");
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex flex-col relative font-sans selection:bg-orange-200">
      
      {/* HEADER: Galeria Sophilia Branding (Di luar kanvas putih) */}
      <header className="bg-black py-8 px-4 flex flex-col items-center justify-center shrink-0 border-b border-white/10 z-10">
        <div className="text-center select-none">
          <h2 className="text-[#fcfcfc] font-light tracking-[0.4em] text-sm md:text-base uppercase">
            Galeria
          </h2>
          <h1 className="text-[#fb9418] font-bold tracking-wider text-4xl md:text-5xl mt-1 uppercase">
            Sophilia
          </h1>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col items-center p-4 sm:p-8 relative">
        
        {/* Dekorasi Background Tambahan */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        {/* CONTENT CONTAINER (Kanvas Putih) */}
        <div className="w-full max-w-2xl bg-[#fcfcfc] rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-200 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="flex flex-col gap-6">
            
            {/* Bagian Pembuka */}
            <div className="text-center pb-2">
              <p className="font-extrabold text-black text-xl sm:text-2xl mb-2">
                Galeria Sophilia dibuka selama 3 jam.
              </p>
              <p className="text-gray-700 font-medium text-base sm:text-lg">
                Temukan pengalaman budaya inspiratif:
              </p>
              <p className="text-gray-400 italic text-sm mt-1">
                Silakan lihat informasi detail pada banner kami.
              </p>
            </div>

            {/* Daftar Lantai */}
            <div className="flex flex-col gap-3">
              {/* Lantai 1 */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-[#fb9418] transition-colors shadow-sm">
                <h3 className="text-sm font-bold text-[#fb9418] uppercase tracking-widest mb-1">
                  Lantai 1
                </h3>
                <p className="text-lg font-bold text-black transition-colors">
                  Karya Seni Patung Barat
                </p>
              </div>

              {/* Lantai 5 */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-[#fb9418] transition-colors shadow-sm">
                <h3 className="text-sm font-bold text-[#fb9418] uppercase tracking-widest mb-1">
                  Lantai 5
                </h3>
                <p className="text-lg font-bold text-black leading-snug">
                  Keramik Tiga Warna Dinasti Tang, <br className="hidden sm:block" />
                  Peninggalan Budaya Jalur Sutra
                </p>
              </div>

              {/* Lantai 6 & 7 */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-[#fb9418] transition-colors shadow-sm">
                <h3 className="text-sm font-bold text-[#fb9418] uppercase tracking-widest mb-1">
                  Lantai 6–7
                </h3>
                <p className="text-lg font-bold text-black">
                  Karya Seni Rupa Barat dan Barang Bersejarah Asia Timur
                </p>
              </div>
            </div>

            {/* Penutup (Call to Action) */}
            <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl text-center mt-2">
              <p className="font-extrabold text-black uppercase tracking-wide mb-2 text-base sm:text-lg">
                Silakan pilih tiket Anda
              </p>
              <p className="text-gray-700 font-medium text-sm sm:text-base">
                untuk satu, dua, atau semua sekaligus
              </p>
              <p className="text-[#fb9418] font-bold mt-1 text-sm sm:text-base">
                dan rasakan perjalanan budaya yang berharga.
              </p>
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-2">
              <button
                onClick={() => navigate('/ticket-selection')}
                className="w-full py-4 font-bold text-[#fcfcfc] bg-[#fb9418] hover:bg-orange-500 rounded-xl transition-all duration-200 shadow-md flex justify-center items-center gap-2 active:scale-95 uppercase tracking-wide"
              >
                Lanjutkan
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default GalleryInfoPage;