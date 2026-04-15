import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FLOORS = [
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
  const navigate = useNavigate();
  // State sekarang menggunakan array untuk menampung banyak pilihan lantai
  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);

  const toggleFloor = (floorId: string) => {
    setSelectedFloors((prev) => 
      prev.includes(floorId) 
        ? prev.filter((id) => id !== floorId) // Hapus jika sudah ada (uncheck)
        : [...prev, floorId]                  // Tambahkan jika belum ada (check)
    );
  };

  const handleContinue = () => {
    if (selectedFloors.length === 0) return;
    
    // Kirim array lantai yang dipilih ke halaman form pengunjung
    navigate('/visitor-form', { state: { selectedFloors } });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <h1 className="text-2xl font-bold text-gray-800">Pilih Tiket</h1>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto p-4 flex flex-col justify-center space-y-4">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Area Pameran</h2>
          <p className="text-gray-500 text-sm mt-1">
            Silakan pilih satu atau lebih lantai yang ingin Anda kunjungi
          </p>
        </div>

        <div className="space-y-4">
          {FLOORS.map((floor) => {
            const isSelected = selectedFloors.includes(floor.id);
            
            return (
              <button
                key={floor.id}
                onClick={() => toggleFloor(floor.id)}
                className={`w-full p-6 rounded-xl border-2 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50 shadow-md scale-[1.02]'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className={`text-xl font-bold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                    {floor.label}
                  </h3>
                  
                  {/* Checkbox indicator */}
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${
                    isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && <span className="font-bold">✓</span>}
                  </div>
                </div>

                {/* Informasi Harga */}
                <div className="bg-white/60 p-3 rounded-lg border border-gray-100 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">Adult</span>
                    <span className="font-bold text-gray-800">Rp {floor.prices.adult.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">Student</span>
                    <span className="font-bold text-gray-800">Rp {floor.prices.student.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-medium">Children</span>
                    <span className="font-bold text-gray-800">Rp {floor.prices.child.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </button>
            );
          })}
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
    </div>
  );
};

export default TicketSelectionPage;