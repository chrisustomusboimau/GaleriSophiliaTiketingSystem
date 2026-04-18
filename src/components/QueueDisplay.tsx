/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Component to display the generated queue ticket.
 * Diperbarui dengan identitas visual Galeria Sophilia.
 * Update: Menambahkan Informasi & Panduan Metode Pembayaran yang jelas.
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
  total_price: number;
  created_at: string;
  payment_method?: string; // TAMBAHAN: Field payment_method
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

  const getCategoryLabel = (category: string) => {
    switch (category.toLowerCase()) {
      case 'child': return translations.childLabel[language];
      case 'student': return translations.teenLabel[language];
      case 'adult': return translations.adultLabel[language];
      default: return category;
    }
  };

  // Group items by age_category to create a clean "Receipt" breakdown
  const groupedItems = useMemo(() => {
    if (!visitor.items) return {};
    
    return visitor.items.reduce((acc, item) => {
      if (!acc[item.age_category]) {
        acc[item.age_category] = {
          items: [],
          quantity: item.quantity, 
          subtotal: 0
        };
      }
      
      const price = item.unit_price || 0;
      acc[item.age_category].items.push(item);
      acc[item.age_category].subtotal += (price * item.quantity);
      
      return acc;
    }, {} as Record<string, { items: TransactionItem[], quantity: number, subtotal: number }>);
  }, [visitor.items]);

  // Label pelokalan untuk panduan pembayaran
  const paymentInstructionLabel = language === "id" ? "Pilihan Pembayaran Anda" : language === "zh" ? "您的付款方式" : "Your Payment Method";
  
  const qrisDesc = language === "id" 
    ? "Tunjukkan nomor antrian ke kasir dan pindai QR Code yang tersedia di meja resepsionis menggunakan aplikasi M-Banking atau E-Wallet Anda." 
    : language === "zh" 
    ? "请向收银员出示此屏幕，并使用您的手机银行或电子钱包扫描接待台上的二维码。" 
    : "Show this screen to the cashier and scan the QR Code available at the reception desk using your M-Banking or E-Wallet app.";

  const cardDesc = language === "id"
    ? "Tunjukkan nomor antrian ke kasir dan persiapkan kartu Debit/Kredit fisik Anda untuk proses pembayaran menggunakan mesin EDC kami."
    : language === "zh"
    ? "请向收银员出示此屏幕，并准备好您的实体借记卡/信用卡，以便使用我们的 EDC 机器进行付款。"
    : "Show this screen to the cashier and prepare your physical Debit/Credit card for payment using our EDC machine.";

  // Default fallback ke QRIS jika tidak ada data
  const isCard = visitor.payment_method === 'card';

  return (
    <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      
      {/* Header: Queue Number & ID (Tema Galeri Gelap) */}
      <header className="bg-black pt-10 pb-8 px-6 text-center border-b-[6px] border-[#fb9418]">
        <h2 className="text-[#fcfcfc] text-sm md:text-base font-light mb-3 tracking-[0.25em] uppercase">
          {translations.queueNumberLabel[language]}
        </h2>
        
        <div className="text-8xl font-extrabold text-[#fb9418] tracking-tighter leading-none mb-6">
          {visitor.queue_number}
        </div>
        
        <div className="inline-block bg-[#1a1a1a] border border-zinc-800 px-4 py-2 rounded-lg">
          <p className="text-xs md:text-sm text-gray-400 font-mono tracking-widest">
            ID: {visitor.id}
          </p>
        </div>
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8 bg-[#fcfcfc]">
        
        {/* Ticket Details Section */}
        <section className="mb-6">
          <h3 className="text-sm md:text-base font-bold text-black mb-5 border-b border-gray-200 pb-3 uppercase tracking-widest">
            Rincian Tiket
          </h3>
          
          <div className="space-y-4">
            
            {/* Dynamic Receipt Breakdown */}
            {Object.keys(groupedItems).length > 0 ? (
              Object.entries(groupedItems).map(([category, data], idx) => {
                const pricePerPerson = data.quantity > 0 ? data.subtotal / data.quantity : 0;
                
                return (
                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    {/* Category Header */}
                    <div className="flex justify-between items-end mb-4 border-b border-gray-100 pb-3">
                      <div>
                        <span className="font-bold text-black capitalize block text-lg mb-1">
                          {getCategoryLabel(category)}
                        </span>
                        <span className="text-xs font-bold text-[#fb9418] bg-orange-50 border border-orange-100 px-3 py-1 rounded-full">
                          {data.quantity} Orang
                        </span>
                      </div>
                      <span className="font-bold text-[#fb9418] text-xl">
                        {formatCurrency(data.subtotal)}
                      </span>
                    </div>

                    {/* Floor Breakdown */}
                    <div className="space-y-2">
                      {data.items.map((item, i) => {
                        const price = item.unit_price || 0;
                        return (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">{item.floor}</span>
                            <span className="text-black font-bold">
                              {item.quantity} &times; {formatCurrency(price)}
                            </span>
                          </div>
                        );
                      })}
                      
                      {/* Price Per Person Summary */}
                      <div className="flex justify-between text-xs text-gray-500 pt-3 mt-3 border-t border-gray-200 border-dashed">
                        <span>Total per orang:</span>
                        <span className="font-semibold text-gray-700">{formatCurrency(pricePerPerson)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 italic text-sm text-center bg-gray-50 py-4 rounded-xl border border-gray-200">
                Data tiket tidak tersedia.
              </p>
            )}

            {/* Final Grand Total */}
            <div className="flex justify-between items-end pt-5 border-t-2 border-black mt-8">
              <span className="font-bold text-black uppercase tracking-wide">Total Pembayaran:</span>
              <span className="font-extrabold text-3xl text-[#fb9418]">
                {formatCurrency(visitor.total_price)}
              </span>
            </div>

          </div>
        </section>

        {/* =====================================
            INFORMASI METODE PEMBAYARAN (BARU)
            ===================================== */}
        <div className="mt-8 mb-6">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            {paymentInstructionLabel}
          </h4>
          
          <div className={`p-4 border-2 rounded-xl flex items-start gap-4 ${
            isCard ? "border-gray-800 bg-gray-50" : "border-green-600 bg-green-50"
          }`}>
            
            {/* Ikon Visual (Kartu atau QRIS) */}
            <div className={`shrink-0 mt-0.5 p-2 rounded-lg ${
              isCard ? "bg-gray-800 text-white" : "bg-green-600 text-white"
            }`}>
              {isCard ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              )}
            </div>

            {/* Teks Instruksi */}
            <div>
              <p className="font-extrabold text-black uppercase tracking-wider mb-1">
                {isCard ? (language === "id" ? "KARTU KREDIT/DEBIT" : "CREDIT/DEBIT CARD") : "QRIS"}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed font-medium">
                {isCard ? cardDesc : qrisDesc}
              </p>
            </div>
          </div>
        </div>

        {/* Instructions / Warning (Diselaraskan dengan aksen Oranye) */}
        {/* <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex gap-4 items-start shadow-sm">
          <svg className="w-6 h-6 text-[#fb9418] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-black leading-relaxed font-medium">
            {translations.queueInstruction[language]}
          </p>
        </div> */}

      </div>
    </div>
  );
};

export default QueueDisplay;