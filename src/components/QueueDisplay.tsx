/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Layar konfirmasi antrean untuk PENGUNJUNG: nomor antrian, kode tiket,
 * total pengunjung, total pembayaran, dan instruksi umum.
 *
 * UPDATE: Rincian item tiket dan instruksi spesifik metode pembayaran (QRIS)
 * telah dihapus sesuai permintaan.
 */

import React, { useMemo } from "react";
import { TransactionEntry } from "../types";
import { formatCurrency, resolveSnapshot } from "../utils/formatters";
import { useLanguage } from "../contexts/LanguageContext";

interface QueueDisplayProps {
  visitor: TransactionEntry;
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ visitor }) => {
  const { language, translations } = useLanguage();

  /**
   * Jumlah ORANG, bukan jumlah tiket. Pengunjung yang membeli 2 lantai
   * menghasilkan dua baris item untuk orang yang sama, jadi menjumlahkan
   * `quantity` begitu saja akan melipatgandakan angkanya. Dedupe memakai
   * nama varian dalam snapshot — satu-satunya penanda varian yang tersedia
   * di layar publik ini (endpoint transaksi tidak membawa master varian).
   */
  const totalPeople = useMemo(() => {
    const byVariant = new Map<string, number>();
    visitor.items.forEach((item) => {
      const { variant, full } = resolveSnapshot(item, language);
      const key = variant || full;
      byVariant.set(key, Math.max(byVariant.get(key) ?? 0, item.quantity));
    });
    return Array.from(byVariant.values()).reduce((sum, v) => sum + v, 0);
  }, [visitor.items, language]);

  const totalTickets = useMemo(
    () => visitor.items.reduce((sum, item) => sum + item.quantity, 0),
    [visitor.items]
  );

  return (
    <div className="w-full max-w-md mx-auto bg-[#fcfcfc] rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
      {/* NOMOR ANTRIAN */}
      <div className="bg-black px-6 py-8 text-center border-b-4 border-[#fb9418]">
        <p className="text-[10px] font-light text-gray-400 uppercase tracking-[0.25em] mb-3">
          {translations.queueNumberLabel[language]}
        </p>
        <p className="text-5xl sm:text-6xl font-black text-[#fb9418] tracking-widest leading-none">
          {visitor.ticket_code}
        </p>
        {visitor.customer_name && (
          <p className="text-gray-300 text-sm font-medium mt-4">
            <span className="text-gray-500 text-xs">{translations.orderedByLabel[language]}: </span>
            {visitor.customer_name}
          </p>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* RINGKASAN */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 font-medium">{translations.totalVisitors[language]}</span>
            <span className="font-bold text-black">
              {totalPeople} {translations.people[language]}
            </span>
          </div>

          <div className="flex justify-between items-end pt-3 mt-1 border-t border-gray-200">
            <span className="text-gray-800 font-bold">{translations.totalPayment[language]}</span>
            <span className="font-black text-2xl text-[#fb9418]">{formatCurrency(visitor.total_price)}</span>
          </div>
        </div>

        {/* INSTRUKSI UMUM */}
        <p className="text-xs text-gray-500 leading-relaxed text-center pt-2">
          {translations.queueInstruction[language]}
        </p>
      </div>
    </div>
  );
};

export default QueueDisplay;