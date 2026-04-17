import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import FloorCard, { FloorData } from '../components/FloorCard';
import GalleryInfoModal from '../components/GalleryInfoModal'; // <-- Tambahkan import ini

const FLOORS: FloorData[] = [
  { 
    id: 'Floor 6/7', 
    label: 'Lantai 6 & 7',
    prices: { adult: 100000, student: 50000, child: 25000 }
  },
  { 
    id: 'Floor 5', 
    label: 'Lantai 5',
    prices: { adult: 40000, student: 20000, child: 10000 }
  },
  { 
    id: 'Floor 1', 
    label: 'Lantai 1',
    prices: { adult: 60000, student: 40000, child: 20000 }
  }
];

const TicketSelectionPage: React.FC = () => {
  const { language, translations } = useLanguage();
  const navigate = useNavigate();
  
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  
  // <-- Tambahkan state untuk mengontrol modal informasi
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false); 

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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      <header className="bg-white shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800">Pilih Tiket</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col justify-center space-y-4">
        
        {/* Header Judul & Tombol Info */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold text-gray-800">Area Pameran</h2>
            
            {/* <-- Tombol 'i' Info ditambahkan di sini */}
            <button 
              onClick={() => setIsInfoOpen(true)}
              className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
              aria-label="Informasi Lantai"
              title="Lihat informasi kurasi lantai"
            >
              <span className="font-serif italic font-bold text-sm">i</span>
            </button>
          </div>
          
          <p className="text-gray-500 text-sm mt-1">
            Silakan pilih satu atau lebih lantai yang ingin Anda kunjungi
          </p>
        </div>

        {/* List Komponen Kartu Lantai */}
        <div className="space-y-4">
          {FLOORS.map((floor) => (
            <FloorCard
              key={floor.id}
              floor={floor}
              isSelected={selectedFloors.includes(floor.id)}
              onToggle={toggleFloor}
              // Oper label yang sudah di-translate dari context
              labels={{
                adult: translations.adultLabel[language],
                teen: translations.teenLabel[language],
                child: translations.childLabel[language],
              }}
            />
          ))}
        </div>

        <div className="pt-8 pb-8">
          <button
            onClick={handleContinue}
            disabled={selectedFloors.length === 0}
            className="w-full py-4 bg-blue-600 text-white font-bold text-lg rounded-lg disabled:bg-gray-400 hover:bg-blue-700 transition-colors shadow-sm"
          >
            Lanjutkan ({selectedFloors.length} Dipilih)
          </button>
        </div>
      </main>

      {/* <-- Render Komponen Modal Info di luar alur DOM utama */}
      <GalleryInfoModal 
        isOpen={isInfoOpen} 
        onClose={() => setIsInfoOpen(false)} 
      />
    </div>
  );
};

export default TicketSelectionPage;