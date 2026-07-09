/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Component to display the generated queue ticket.
 * Tampilan ultra-minimalis: 
 * - Tanpa ID Tiket
 * - Rincian ringkas (Jumlah x Kategori - Lantai)
 * - Metode pembayaran disederhanakan dalam satu box
 */

import React from 'react';
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
  id: string; // Tetap ada di interface agar tidak error dengan data API
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
  // Ambil label bahasa dari context, fallback ke manual jika tidak ada
  const paymentLabel = isCard 
    ? (translations.creditDebitCard?.[language] || "KARTU") 
    : "QRIS";

  return (
    <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      
      {/* Header: Hanya Queue Number (Tanpa ID) */}
      <header className="bg-black pt-10 pb-10 px-6 text-center border-b-[6px] border-[#fb9418]">
        <h2 className="text-[#fcfcfc] text-sm md:text-base font-light mb-3 tracking-[0.25em] uppercase">
          {translations.queueNumberLabel[language]}
        </h2>
        
        <div className="text-4xl sm:text-5xl font-extrabold text-[#fb9418] tracking-widest leading-none">
          {visitor.ticket_code}
        </div>
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8 bg-[#fcfcfc]">
        
        {/* Main Box - Menyatukan seluruh informasi */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          
          {/* 1. Rincian Kategori & Lantai (Tanpa detail harga) */}
          <div className="mb-5 space-y-3">
            {visitor.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm sm:text-base border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <span className="text-gray-700 font-medium capitalize">
                  {/* Menghapus line-break (\n) bawaan jika ada agar teks sebaris */}
                  <span className="font-bold text-black mr-2">{item.quantity}&times;</span> 
                  {getCategoryLabel(item.age_category).replace('\n', ' ')}
                </span>
                <span className="text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-md text-xs sm:text-sm">
                  {item.floor}
                </span>
              </div>
            ))}
          </div>

          {/* 2. Metode Pembayaran (Sederhana) */}
          <div className="flex justify-between items-center border-t border-gray-200 border-dashed pt-4 pb-4">
            <span className="font-bold text-gray-500 uppercase tracking-widest text-xs sm:text-sm">
              Metode
            </span>
            <span className="font-extrabold text-black uppercase flex items-center gap-2 text-sm sm:text-base">
              {/* Ikon Mini */}
              {isCard ? (
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              ) : (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              )}
              {paymentLabel}
            </span>
          </div>

          {/* 3. Total Pembayaran */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-t-2 border-black pt-5 mt-1">
            <span className="font-bold text-black uppercase tracking-wide text-sm sm:text-base mb-1 sm:mb-0">
              {translations.totalPayment[language]}
            </span>
            <span className="font-extrabold text-3xl text-[#fb9418]">
              {formatCurrency(visitor.total_price)}
            </span>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default QueueDisplay;