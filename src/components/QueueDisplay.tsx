/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Component to display the generated queue ticket.
 * Diperbarui dengan identitas visual Galeria Sophilia.
 * Update: Terintegrasi penuh dengan LanguageContext untuk dukungan multibahasa.
 * Update: Tampilan disederhanakan (Hanya total tiket, harga, dan metode).
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

  // Menghitung total seluruh tiket yang dibeli
  const totalTickets = useMemo(() => {
    if (!visitor.items) return 0;
    return visitor.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [visitor.items]);

  const isCard = visitor.payment_method === 'card';

  return (
    <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      
      {/* Header: Queue Number & ID */}
      <header className="bg-black pt-10 pb-8 px-6 text-center border-b-[6px] border-[#fb9418]">
        <h2 className="text-[#fcfcfc] text-sm md:text-base font-light mb-3 tracking-[0.25em] uppercase">
          {translations.queueNumberLabel[language]}
        </h2>
        
        {/* Font diperkecil menjadi text-3xl / 4xl agar lebih rapi */}
        <div className="text-3xl sm:text-4xl font-extrabold text-[#fb9418] tracking-widest leading-none mb-6">
          {visitor.ticket_code}
        </div>
        
        <div className="inline-block bg-[#1a1a1a] border border-zinc-800 px-4 py-2 rounded-lg">
          <p className="text-xs md:text-sm text-gray-400 font-mono tracking-widest break-all text-center">
            ID: {visitor.id}
          </p>
        </div>
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8 bg-[#fcfcfc]">
        
        {/* Summary Section (Simple) */}
        <section className="mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            
            {/* Jumlah Tiket */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
              <span className="font-bold text-gray-500 uppercase tracking-widest text-xs sm:text-sm">
                Total Tiket
              </span>
              <span className="font-extrabold text-black text-lg">
                {totalTickets} {translations.people[language]}
              </span>
            </div>

            {/* Total Pembayaran */}
            <div className="flex justify-between items-center">
              <span className="font-bold text-black uppercase tracking-wide text-sm sm:text-base">
                {translations.totalPayment[language]}
              </span>
              <span className="font-extrabold text-2xl sm:text-3xl text-[#fb9418]">
                {formatCurrency(visitor.total_price)}
              </span>
            </div>
            
          </div>
        </section>

        {/* =====================================
            INFORMASI METODE PEMBAYARAN (SIMPLE)
            ===================================== */}
        <section className="mb-4">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 text-center">
            {translations.yourPaymentMethod[language]}
          </h4>
          
          <div className={`p-4 border-2 rounded-xl flex items-center justify-center gap-3 ${
            isCard ? "border-gray-800 bg-gray-50" : "border-green-600 bg-green-50"
          }`}>
            
            {/* Ikon Visual */}
            <div className={`shrink-0 p-2 rounded-lg ${
              isCard ? "bg-gray-800 text-white" : "bg-green-600 text-white"
            }`}>
              {isCard ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              )}
            </div>

            {/* Nama Pembayaran Saja */}
            <p className="font-extrabold text-black text-xl uppercase tracking-wider">
              {isCard ? translations.creditDebitCard[language] : "QRIS"}
            </p>
            
          </div>
        </section>

      </div>
    </div>
  );
};

export default QueueDisplay;