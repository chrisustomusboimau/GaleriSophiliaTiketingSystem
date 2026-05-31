/**
 * TicketSelectionPage.tsx
 * ----------------------------------------------------
 * Halaman pertama untuk pengunjung.
 * Menampilkan pilihan lantai, mengelola state lantai yang dipilih,
 * dan meneruskan data tersebut ke halaman VisitorForm.
 * Diperbarui dengan identitas visual Galeria Sophilia.
 * Update: Terintegrasi penuh dengan LanguageContext untuk dukungan multibahasa.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import FloorCard, { FloorData } from '../components/FloorCard';
import GalleryInfoModal from '../components/GalleryInfoModal';
import Header from '../components/Header'; // <Header />

const TicketSelectionPage: React.FC = () => {
  const { language, translations } = useLanguage();
  const navigate = useNavigate();
  
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false); 

  // Memindahkan data FLOORS ke dalam useMemo agar nama lantai (label)
  // dapat diterjemahkan secara otomatis saat bahasa diubah.
  const floorsData: FloorData[] = useMemo(() => [
    { 
      id: 'Floor 6/7', 
      label: translations.floor6And7Label[language],
      prices: { adult: 100000, student: 50000, child: 25000 }
    },
    { 
      id: 'Floor 5', 
      label: translations.floor5Label[language],
      prices: { adult: 40000, student: 20000, child: 10000 }
    },
    { 
      id: 'Floor 1', 
      label: translations.floor1Label[language],
      prices: { adult: 60000, student: 40000, child: 20000 }
    }
  ], [language, translations]);

  const toggleFloor = (floorId: string) => {
    setSelectedFloors((prev) => 
      prev.includes(floorId) 
        ? prev.filter((id) => id !== floorId) 
        : [...prev, floorId]                  
    );
  };

  const handleContinue = () => {
    if (selectedFloors.length === 0) return;
    navigate('/visitor-form', { state: { selectedFloors } });
  };

  // Dinamis text untuk tombol "Lanjutkan ({count} Dipilih)"
  const continueButtonText = translations.continueSelected[language]
    ? translations.continueSelected[language].replace("{count}", selectedFloors.length.toString())
    : "";

  return (
    <div className="min-h-screen bg-black flex flex-col relative font-sans">
      
      {/* HEADER: Galeria Sophilia Branding (Tetap tidak diterjemahkan karena nama brand) */}
      <Header />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col items-center p-4 sm:p-8 relative">
        
        {/* Dekorasi Background Tambahan */}
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        {/* Content Container Putih */}
        <div className="w-full max-w-lg bg-[#fcfcfc] rounded-2xl shadow-2xl p-6 sm:p-8 border border-gray-200">
          
          {/* Header Judul & Tombol Info */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-bold text-black uppercase tracking-wide">
                {translations.exhibitionArea[language]}
              </h2>
              
              {/* Tombol 'i' Info (Aksen Oranye) */}
              <button 
                onClick={() => setIsInfoOpen(true)}
                className="w-6 h-6 rounded-full bg-orange-100 text-[#fb9418] flex items-center justify-center hover:bg-[#fb9418] hover:text-[#fcfcfc] transition-colors focus:outline-none focus:ring-2 focus:ring-[#fb9418] focus:ring-offset-1"
                aria-label={translations.floorInfoAria[language]}
                title={translations.floorInfoTitle[language]}
              >
                <span className="font-serif italic font-bold text-sm">i</span>
              </button>
            </div>
            
            <p className="text-gray-500 text-sm mt-2">
              {translations.selectFloorInstruction[language]}
            </p>
          </div>

          {/* List Komponen Kartu Lantai */}
          <div className="space-y-4">
            {floorsData.map((floor) => (
              <FloorCard
                key={floor.id}
                floor={floor}
                isSelected={selectedFloors.includes(floor.id)}
                onToggle={toggleFloor}
                labels={{
                  adult: translations.adultLabel[language],
                  teen: translations.teenLabel[language],
                  child: translations.childLabel[language],
                }}
              />
            ))}
          </div>

          {/* Tombol Lanjut (Aksen Oranye) */}
          <div className="pt-8">
            <button
              onClick={handleContinue}
              disabled={selectedFloors.length === 0}
              className={`w-full py-4 font-bold text-[#fcfcfc] rounded-xl transition-all duration-200 shadow-md flex justify-center items-center gap-2 ${
                selectedFloors.length === 0
                  ? "bg-gray-400 cursor-not-allowed shadow-none"
                  : "bg-[#fb9418] hover:bg-orange-500 hover:shadow-lg active:scale-95"
              }`}
            >
              {selectedFloors.length === 0 ? translations.continueButton[language] : continueButtonText}
              {selectedFloors.length > 0 && (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Render Komponen Modal Info */}
      <GalleryInfoModal 
        isOpen={isInfoOpen} 
        onClose={() => setIsInfoOpen(false)} 
      />
    </div>
  );
};

export default TicketSelectionPage;