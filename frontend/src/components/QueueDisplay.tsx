/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Component to display the generated queue ticket.
 * * Features:
 * - Shows the large queue number and Transaction ID.
 * - Groups and displays a highly detailed, receipt-style price breakdown.
 * - Aligned with the new FastAPI backend data contract (items array).
 */

import React, { useMemo } from 'react';
import { formatCurrency } from '../utils/priceCalculator';
import { useLanguage } from "../contexts/LanguageContext";

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface TransactionOrigin {
  country_code: string;
  count: number;
}

export interface TransactionItem {
  floor: string;
  age_category: string;
  quantity: number;
  unit_price?: number; 
}

export interface Visitor {
  id: string;
  queue_number: number;
  total_price: number;
  status: string;
  created_at: string;
  origins: TransactionOrigin[]; 
  items: TransactionItem[]; 
}

interface QueueDisplayProps {
  visitor: Visitor;
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

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      
      {/* Header: Queue Number & ID */}
      <header className="bg-blue-600 p-6 text-center">
        <h2 className="text-blue-100 text-lg font-medium mb-1 tracking-wide">
          {translations.queueNumberLabel[language]}
        </h2>
        <div className="text-6xl font-extrabold text-white tracking-tight drop-shadow-md">
          {visitor.queue_number}
        </div>
        <p className="text-sm text-blue-200 mt-4 font-mono bg-blue-700/30 inline-block px-3 py-1 rounded-md">
          ID: {visitor.id}
        </p>
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8">
        
        {/* Ticket Details Section */}
        <section className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
            Rincian Tiket
          </h3>
          
          <div className="space-y-4">
            
            {/* Dynamic Receipt Breakdown */}
            {Object.keys(groupedItems).length > 0 ? (
              Object.entries(groupedItems).map(([category, data], idx) => {
                const pricePerPerson = data.quantity > 0 ? data.subtotal / data.quantity : 0;
                
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 shadow-sm">
                    {/* Category Header */}
                    <div className="flex justify-between items-end mb-3 border-b border-slate-200 pb-2">
                      <div>
                        <span className="font-bold text-gray-800 capitalize block text-lg">
                          {getCategoryLabel(category)}
                        </span>
                        <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          {data.quantity} Orang
                        </span>
                      </div>
                      <span className="font-bold text-blue-700 text-lg">
                        {formatCurrency(data.subtotal)}
                      </span>
                    </div>

                    {/* Floor Breakdown */}
                    <div className="space-y-2">
                      {data.items.map((item, i) => {
                        const price = item.unit_price || 0;
                        return (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{item.floor}</span>
                            <span className="text-gray-800 font-medium">
                              {item.quantity} &times; {formatCurrency(price)}
                            </span>
                          </div>
                        );
                      })}
                      
                      {/* Price Per Person Summary */}
                      <div className="flex justify-between text-xs text-gray-500 pt-2 mt-2 border-t border-slate-200 border-dashed">
                        <span>Total per orang:</span>
                        <span className="font-semibold">{formatCurrency(pricePerPerson)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 italic text-sm text-center bg-gray-50 py-4 rounded-lg">Data tiket tidak tersedia.</p>
            )}

            {/* Final Grand Total */}
            <div className="flex justify-between items-end pt-5 border-t-2 border-gray-800 mt-6">
              <span className="font-bold text-gray-800 uppercase tracking-wide">Total Pembayaran:</span>
              <span className="font-extrabold text-2xl text-blue-700">
                {formatCurrency(visitor.total_price)}
              </span>
            </div>

          </div>
        </section>

        {/* Instructions / Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start shadow-sm">
          <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-900 leading-relaxed font-medium">
            {translations.queueInstruction[language]}
          </p>
        </div>

      </div>
    </div>
  );
};

export default QueueDisplay;