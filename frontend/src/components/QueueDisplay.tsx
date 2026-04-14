/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Component to display the generated queue ticket.
 * * Features:
 * - Shows the large queue number.
 * - Generates a QR code containing the queue ID and number.
 * - Displays a breakdown of ticket quantities and country origins.
 * - Aligned with the new FastAPI backend data contract.
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getData } from 'country-list';
import { formatCurrency } from '../utils/priceCalculator';
import { useLanguage } from "../contexts/LanguageContext";


/* =====================================================
   TYPES & INTERFACES
===================================================== */

// Matches the OriginBase schema from the backend
export interface TransactionOrigin {
  country_code: string;
  count: number;
}

// Matches the TransactionResponse schema from the backend
export interface Visitor {
  id: string;
  queue_number: number;
  under_8_count: number;
  under_22_count: number;
  adult_count: number;
  total_price: number;
  status: string;
  created_at: string;
  origins: TransactionOrigin[]; 
}

interface QueueDisplayProps {
  visitor: Visitor;
}

/* =====================================================
   HELPERS
===================================================== */

/**
 * Retrieves the full country name based on the 2-letter country code.
 * Uses the `country-list` library to stay perfectly synced with the form.
 */
const getCountryName = (countryCode?: string): string => {
  if (!countryCode) return '';
  
  const targetCode = countryCode.toLowerCase();
  const country = getData().find((c) => c.code.toLowerCase() === targetCode);
  
  return country ? country.name : countryCode.toUpperCase();
};

/* =====================================================
   MAIN COMPONENT
===================================================== */

const QueueDisplay: React.FC<QueueDisplayProps> = ({ visitor }) => {
  const { language, translations } = useLanguage();

  const qrPayload = JSON.stringify({
    id: visitor.id,
    queueNumber: visitor.queue_number,
  });

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
      
      {/* Header: Queue Number */}
      <header className="bg-blue-600 p-6 text-center">
        <h2 className="text-blue-100 text-lg font-medium mb-1 tracking-wide">
          {translations.queueNumberLabel[language]}
        </h2>
        <div className="text-6xl font-extrabold text-white tracking-tight">
          {visitor.queue_number}
        </div>
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8">
        
        {/* QR Code Section */}
        <div className="flex flex-col items-center justify-center mb-8 pb-8 border-b border-gray-100">
          <div className="p-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <QRCodeSVG 
              value={qrPayload} 
              size={180} 
              includeMargin={true} 
              bgColor="#ffffff" 
              fgColor="#111827" 
              level="L" 
            />
          </div>
          <p className="text-sm text-gray-400 mt-4">
            ID: {visitor.id.slice(0, 8)}...
          </p>
        </div>

        {/* Ticket Details Section */}
        <section className="mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            {translations.visitorDetailTitle[language]}
          </h3>
          
          <div className="space-y-3 text-gray-700 text-sm md:text-base">
            
            {/* Age Categories */}
            {visitor.under_8_count > 0 && (
              <div className="flex justify-between items-center">
                <span>{translations.childLabel[language]}:</span>
                <span className="font-semibold bg-gray-50 px-2 py-1 rounded">
                  {visitor.under_8_count} {translations.people[language]}
                </span>
              </div>
            )}

            {visitor.under_22_count > 0 && (
              <div className="flex justify-between items-center">
                <span>{translations.teenLabel[language]}:</span>
                <span className="font-semibold bg-gray-50 px-2 py-1 rounded">
                  {visitor.under_22_count} {translations.people[language]}
                </span>
              </div>
            )}

            {visitor.adult_count > 0 && (
              <div className="flex justify-between items-center">
                <span>{translations.adultLabel[language]}:</span>
                <span className="font-semibold bg-gray-50 px-2 py-1 rounded">
                  {visitor.adult_count} {translations.people[language]}
                </span>
              </div>
            )}

            {/* Country Origins - Mapped from the updated API schema */}
            {visitor.origins && visitor.origins.length > 0 && (
              <div className="pt-2">
                <span className="block mb-2 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                  Negara Asal
                </span>
                {visitor.origins.map((origin, index) => (
                  <div key={index} className="flex justify-between items-center mb-1 text-sm">
                    <span className="text-gray-600">
                      {getCountryName(origin.country_code)}
                    </span>
                    <span className="font-medium text-gray-800">
                      {origin.count} orang
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Total Price */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200 mt-4">
              <span className="font-semibold text-gray-800">{translations.totalPriceLabel[language]}:</span>
              <span className="font-bold text-xl text-blue-700">
                {formatCurrency(visitor.total_price)}
              </span>
            </div>

          </div>
        </section>

        {/* Instructions / Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
          <svg className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-amber-800 leading-relaxed">
            {translations.queueInstruction[language]}
          </p>
        </div>

      </div>
    </div>
  );
};

export default QueueDisplay;