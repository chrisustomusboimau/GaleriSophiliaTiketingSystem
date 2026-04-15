/**
 * SuccessQueueModal.tsx
 * ----------------------------------------------------
 * Modal sederhana yang dipanggil HANYA untuk menampilkan 
 * nomor antrian setelah transaksi manual berhasil dibuat.
 */

import React from 'react';

interface SuccessQueueModalProps {
  isOpen: boolean;
  queueNumber: number | null;
  onClose: () => void;
}

const SuccessQueueModal: React.FC<SuccessQueueModalProps> = ({ 
  isOpen, 
  queueNumber, 
  onClose 
}) => {
  if (!isOpen || queueNumber === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        
        <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          
          <h4 className="text-2xl font-bold text-gray-800">Tiket Dibuat!</h4>
          <p className="text-gray-500 text-base font-medium">Nomor antrian pengunjung ini:</p>
          
          <div className="text-[5rem] leading-none font-black text-emerald-600 py-4 drop-shadow-sm">
            {queueNumber}
          </div>
          
          <button 
            onClick={onClose} 
            className="w-full mt-4 px-4 py-4 text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95"
          >
            Selesai & Tutup
          </button>
        </div>

      </div>
    </div>
  );
};

export default SuccessQueueModal;