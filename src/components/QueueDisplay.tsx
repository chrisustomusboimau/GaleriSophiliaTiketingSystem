/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Component to display the generated queue ticket.
 * Tampilan ultra-minimalis & rapi:
 * - Nomor antrian satu baris dengan ukuran font lebih kecil.
 * - Ringkasan lantai yang dikunjungi dibuat list ke bawah (vertikal).
 * - Ringkasan jumlah kategori (Anak/Remaja/Dewasa).
 * - Metode pembayaran teks murni tanpa ikon.
 * - Ukuran font Total Pembayaran diperkecil agar lebih rapi.
 */

import React, { useMemo } from 'react';
import { formatCurrency } from '../utils/priceCalculator';
import { useLanguage } from "../contexts/LanguageContext";

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price?: number;
}

export interface QueueDisplayVisitor {
  id: string; 
  queue_number: number;
  ticket_code: string; 
  total_price: number;
  created_at: string;
  payment_method?: string; 
  items: TransactionItem[];
}

interface QueueDisplayProps {
  visitor: QueueDisplayVisitor;
}

/* =====================================================
   MAIN COMPONENT
===================================================== */

const QueueDisplay: React.FC<QueueDisplayProps> = ({ visitor }) => {
  const { language, translations } = useLanguage();

  // Helper untuk mendapatkan label usia dengan benar
  const getCategoryLabel = (category: string) => {
    switch (category.toLowerCase()) {
      case 'child': return translations.childLabel[language];
      case 'student': return translations.teenLabel[language];
      case 'adult': return translations.adultLabel[language];
      default: return category;
    }
  };

  const isCard = visitor.payment_method === 'card';
  const paymentLabel = isCard 
    ? (translations.creditDebitCard?.[language] || "KARTU KREDIT/DEBIT") 
    : "QRIS";

  // =====================================================
  // LOGIKA REKAPITULASI TIKET
  // =====================================================
  const ticketSummary = useMemo(() => {
    if (!visitor.items || visitor.items.length === 0) {
      return { floors: [], counts: {} };
    }

    // 1. Ambil daftar lantai unik yang dikunjungi sebagai Array
    const uniqueFloors = Array.from(new Set(visitor.items.map(i => i.floor)));

    // 2. Hitung jumlah pengunjung berdasarkan kategori usia
    const counts = visitor.items.reduce((acc, item) => {
      acc[item.age_category] = Math.max((acc[item.age_category] || 0), item.quantity);
      return acc;
    }, {} as Record<string, number>);

    return { floors: uniqueFloors, counts };
  }, [visitor.items]);

  return (
    <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      
      {/* Header: Nomor Antrian Satu Baris */}
      <header className="bg-black pt-10 pb-10 px-6 text-center border-b-[6px] border-[#fb9418]">
        <h2 className="text-[#fcfcfc] text-sm md:text-base font-light mb-3 tracking-[0.25em] uppercase">
          {translations.queueNumberLabel[language]}
        </h2>
        
        {/* Ukuran font diperkecil (text-2xl / 3xl / 4xl) agar tidak terlalu penuh */}
        <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#fb9418] tracking-widest leading-none whitespace-nowrap">
          {visitor.ticket_code}
        </div>
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8 bg-[#fcfcfc]">
        
        {/* Main Box - Menyatukan seluruh informasi */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          
          <div className="mb-5 space-y-3">
            
            {/* Lantai yang Dikunjungi (List ke bawah) */}
            <div className="flex justify-between items-start text-sm sm:text-base border-b border-gray-100 pb-3 mb-2">
              <span className="text-gray-500 font-bold uppercase text-xs sm:text-sm tracking-widest mt-0.5">
                Lantai Dikunjungi
              </span>
              <div className="flex flex-col items-end gap-1">
                {ticketSummary.floors.length > 0 ? (
                  ticketSummary.floors.map((floor, idx) => (
                    <span key={idx} className="text-black font-extrabold text-right">
                      {floor}
                    </span>
                  ))
                ) : (
                  <span className="text-black font-extrabold text-right">-</span>
                )}
              </div>
            </div>
            
            {/* Rincian Kategori Usia */}
            {Object.entries(ticketSummary.counts).map(([cat, count], idx) => (
              <div key={idx} className="flex justify-between items-center text-sm sm:text-base border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-700 font-medium capitalize">
                  {getCategoryLabel(cat).replace('\n', ' ')}
                </span>
                <span className="text-black font-bold">
                  {count} orang
                </span>
              </div>
            ))}
          </div>

          {/* Metode Pembayaran (Teks Saja) */}
          <div className="flex justify-between items-center border-t border-gray-200 border-dashed pt-4 pb-4">
            <span className="font-bold text-gray-500 uppercase tracking-widest text-xs sm:text-sm">
              Metode
            </span>
            <span className="font-extrabold text-black uppercase text-sm sm:text-base">
              {paymentLabel}
            </span>
          </div>

          {/* Total Pembayaran (Diperkecil) */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-t-2 border-black pt-4 mt-1">
            <span className="font-bold text-black uppercase tracking-wide text-xs sm:text-sm mb-1 sm:mb-0">
              {translations.totalPayment[language]}
            </span>
            <span className="font-extrabold text-xl sm:text-2xl text-[#fb9418]">
              {formatCurrency(visitor.total_price)}
            </span>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default QueueDisplay;