import React from 'react';

// 1. Export FloorData agar bisa dipakai di halaman utama
export interface FloorData {
  id: string;
  label: string;
  prices: { adult: number; student: number; child: number };
}

// 2. Definisikan Props yang akan diterima komponen ini
interface FloorCardProps {
  floor: FloorData;
  isSelected: boolean;
  onToggle: (id: string) => void;
  labels: {
    adult: string;
    teen: string;
    child: string;
  };
}

// 3. WAJIB: Masukkan <FloorCardProps> ke React.FC
const FloorCard: React.FC<FloorCardProps> = ({ floor, isSelected, onToggle, labels }) => {
  return (
    <button
      onClick={() => onToggle(floor.id)}
      className={`w-full p-6 rounded-xl border-2 text-left transition-all duration-200 ${
        isSelected
          ? 'border-[#fb9418] bg-orange-50 shadow-md scale-[1.02]' // Menggunakan aksen oranye
          : 'border-gray-200 bg-white hover:border-[#fb9418]' // Efek hover oranye
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        {/* Judul lantai menjadi oranye jika dipilih, hitam jika tidak */}
        <h3 className={`text-xl font-bold ${isSelected ? 'text-[#fb9418]' : 'text-black'}`}>
          {floor.label}
        </h3>
        
        {/* Indikator Checkbox berubah menjadi oranye saat dipilih */}
        <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${
          isSelected ? 'bg-[#fb9418] border-[#fb9418] text-[#fcfcfc]' : 'border-gray-300 bg-white'
        }`}>
          {isSelected && <span className="font-bold">✓</span>}
        </div>
      </div>

      <div className="bg-white/60 p-3 rounded-lg border border-gray-100 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 font-medium">{labels.adult}</span>
          <span className="font-bold text-black">Rp {floor.prices.adult.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 font-medium">{labels.teen}</span>
          <span className="font-bold text-black">Rp {floor.prices.student.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600 font-medium">{labels.child}</span>
          <span className="font-bold text-black">Rp {floor.prices.child.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </button>
  );
};

export default FloorCard;