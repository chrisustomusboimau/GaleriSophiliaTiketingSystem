/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Menampilkan tiket antrian yang baru dibuat.
 *
 * UPDATE TOTAL (selaras backend baru):
 * - Tipe data disamakan dengan `TransactionEntry` sungguhan: item tiket
 *   sekarang punya `ticket_name_snapshot` (mis. "Tiket Lantai 1 - Dewasa"),
 *   bukan lagi `floor` + `age_category` terpisah. Dipecah lewat
 *   `splitTicketSnapshot()` (sama seperti dipakai di dashboard kasir), dan
 *   dikelompokkan per lantai lengkap dengan qty x harga per variannya
 *   (lebih rinci dari sekadar hitungan per kategori usia seperti versi lama).
 * - `customer_name` (nama pemesan) sekarang wajib ada di data & ditampilkan.
 * - Metode pembayaran mendukung 3 pilihan (qris/card/cash), lengkap dengan
 *   instruksi masing-masing — sebelumnya cuma qris/card, dan instruksinya
 *   sendiri sebenarnya sudah ada terjemahannya tapi belum pernah dipakai.
 */

import React, { useMemo } from "react";
import { formatCurrency, splitTicketSnapshot } from "../utils/formatters";
import { useLanguage } from "../contexts/LanguageContext";

/* =====================================================
   TYPES & INTERFACES
===================================================== */

export interface TransactionItem {
  ticket_sub_category_id: string;
  ticket_name_snapshot: string;
  quantity: number;
  unit_price: number;
}

export interface QueueDisplayVisitor {
  id: string;
  queue_number: number;
  ticket_code: string;
  customer_name: string;
  total_price: number;
  created_at: string;
  payment_method: "qris" | "card" | "cash" | string;
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

  const paymentInfo = useMemo(() => {
    switch (visitor.payment_method) {
      case "card":
        return { label: translations.creditDebitCard?.[language] || "Kartu Kredit/Debit", instruction: translations.cardInstruction[language] };
      case "cash":
        return { label: translations.cashPaymentLabel[language], instruction: translations.cashInstruction[language] };
      default:
        return { label: "QRIS", instruction: translations.qrisInstruction[language] };
    }
  }, [visitor.payment_method, language, translations]);

  // Kelompokkan item per lantai (master), lengkap dengan rincian varian +
  // qty + harga — lebih rinci dari sekadar "jumlah per kategori usia".
  const groupedByFloor = useMemo(() => {
    const groups: Record<string, { name: string; quantity: number; unit_price: number }[]> = {};
    visitor.items.forEach((item) => {
      const { group, variant } = splitTicketSnapshot(item.ticket_name_snapshot);
      if (!groups[group]) groups[group] = [];
      groups[group].push({ name: variant || item.ticket_name_snapshot, quantity: item.quantity, unit_price: item.unit_price });
    });
    return groups;
  }, [visitor.items]);

  const floorNames = Object.keys(groupedByFloor);

  return (
    <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header: Nomor Antrian */}
      <header className="bg-black pt-10 pb-10 px-6 text-center border-b-[6px] border-[#fb9418]">
        <h2 className="text-[#fcfcfc] text-sm md:text-base font-light mb-3 tracking-[0.25em] uppercase">{translations.queueNumberLabel[language]}</h2>
        <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-[#fb9418] tracking-widest leading-none whitespace-nowrap">
          {visitor.ticket_code}
        </div>
        {visitor.customer_name && (
          <p className="text-gray-300 text-sm font-medium mt-3 truncate">
            {translations.orderedByLabel[language]}: <span className="text-white font-bold">{visitor.customer_name}</span>
          </p>
        )}
      </header>

      {/* Body Area */}
      <div className="p-6 md:p-8 bg-[#fcfcfc] space-y-4">
        {/* Rincian Tiket per Lantai */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-gray-500 font-bold uppercase text-xs sm:text-sm tracking-widest mb-3">{translations.ticketDetails[language]}</p>

          {floorNames.length === 0 ? (
            <p className="text-sm text-gray-400 italic">{translations.noTicketData[language]}</p>
          ) : (
            <div className="space-y-4">
              {floorNames.map((floorName) => (
                <div key={floorName}>
                  <p className="text-black font-extrabold text-sm mb-1.5">{floorName}</p>
                  <div className="space-y-1">
                    {groupedByFloor[floorName].map((v, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">
                          {v.quantity} × {v.name}
                        </span>
                        <span className="text-black font-bold">{formatCurrency(v.quantity * v.unit_price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metode Pembayaran + Instruksi */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-gray-500 uppercase tracking-widest text-xs sm:text-sm">{translations.yourPaymentMethod[language]}</span>
            <span className="font-extrabold text-black uppercase text-sm sm:text-base text-right">{paymentInfo.label}</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{paymentInfo.instruction}</p>
        </div>

        {/* Total Pembayaran */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex justify-between items-center">
          <span className="font-bold text-black uppercase tracking-wide text-xs sm:text-sm mr-2">{translations.totalPayment[language]}</span>
          <span className="font-extrabold text-xl sm:text-2xl text-[#fb9418] whitespace-nowrap">{formatCurrency(visitor.total_price)}</span>
        </div>

        {/* Instruksi umum */}
        <p className="text-center text-xs sm:text-sm text-gray-500 leading-relaxed px-2">{translations.queueInstruction[language]}</p>
      </div>
    </div>
  );
};

export default QueueDisplay;
