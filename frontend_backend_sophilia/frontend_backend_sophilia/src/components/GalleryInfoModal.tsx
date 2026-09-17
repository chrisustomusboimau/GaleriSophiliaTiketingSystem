/**
 * GalleryInfoModal.tsx
 * ----------------------------------------------------
 * Modal informasi eksibisi untuk pengunjung.
 * Diperbarui dengan informasi ringkas tanpa gambar.
 */

import React, { useEffect, useState } from 'react';

interface GalleryInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GalleryInfoModal: React.FC<GalleryInfoModalProps> = ({ isOpen, onClose }) => {
  const [show, setShow] = useState(false);

  // Efek transisi masuk/keluar yang halus
  useEffect(() => {
    if (isOpen) {
      setShow(true);
      document.body.style.overflow = 'hidden'; // Cegah scroll di background
    } else {
      setTimeout(() => setShow(false), 300); // Tunggu animasi selesai sebelum unmount
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  if (!isOpen && !show) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        isOpen ? 'bg-black/60 backdrop-blur-sm opacity-100' : 'bg-black/0 opacity-0 pointer-events-none'
      }`}
      onClick={onClose} // Tutup saat klik di luar (backdrop)
    >
      <div 
        className={`bg-[#fcfcfc] w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform ${
          isOpen ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-8 scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()} // Cegah klik di dalam box menutup modal
      >
        {/* Header Lengket (Sticky) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0 bg-[#fcfcfc]/90 backdrop-blur">
          <h2 className="text-xl sm:text-2xl font-bold text-black tracking-wide uppercase">
            GALERIA SOPHILIA
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-[#fb9418] hover:bg-orange-50 rounded-full transition-colors focus:outline-none"
            aria-label="Tutup"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="p-6 overflow-y-auto space-y-8 text-gray-700 custom-scrollbar text-center">
          
          {/* Bagian Pembuka */}
          <div className="space-y-2 text-sm sm:text-base leading-relaxed">
            <p className="font-bold text-black text-lg">
              Galeria Sophilia dibuka selama 3 jam.
            </p>
            <p>Temukan pengalaman budaya inspiratif:</p>
            <p className="text-gray-500 italic text-sm">
              Silakan lihat informasi detail pada banner kami.
            </p>
          </div>

          {/* Daftar Lantai */}
          <div className="space-y-4">
            
            {/* Lantai 1 */}
            <section className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-[#fb9418] uppercase tracking-widest mb-2">
                Lantai 1
              </h3>
              <p className="text-base sm:text-lg font-bold text-black">
                Karya Seni Patung Barat
              </p>
            </section>

            {/* Lantai 5 */}
            <section className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-[#fb9418] uppercase tracking-widest mb-2">
                Lantai 5
              </h3>
              <p className="text-base sm:text-lg font-bold text-black leading-snug">
                Keramik Tiga Warna Dinasti Tang, <br className="hidden sm:block" />
                Peninggalan Budaya Jalur Sutra
              </p>
            </section>

            {/* Lantai 6 & 7 */}
            <section className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-[#fb9418] uppercase tracking-widest mb-2">
                Lantai 6–7
              </h3>
              <p className="text-base sm:text-lg font-bold text-black">
                Karya Seni Rupa Barat dan Barang Bersejarah Asia Timur
              </p>
            </section>

          </div>

          {/* Bagian Penutup (Call to Action) */}
          <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl shadow-sm space-y-1 text-sm sm:text-base">
            <p className="font-extrabold text-black uppercase tracking-wide mb-2">
              Silakan pilih tiket Anda
            </p>
            <p className="text-black">
              untuk satu, dua, atau semua sekaligus
            </p>
            <p className="text-[#fb9418] font-bold">
              dan rasakan perjalanan budaya yang berharga.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GalleryInfoModal;