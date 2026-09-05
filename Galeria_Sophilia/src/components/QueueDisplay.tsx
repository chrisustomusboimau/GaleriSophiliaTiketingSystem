/**
 * QueueDisplay.tsx
 * ----------------------------------------------------
 * Layar konfirmasi antrean untuk PENGUNJUNG: nomor antrian, kode tiket,
 * rincian tiket yang dibeli, total pembayaran, dan instruksi sesuai metode
 * pembayaran yang dipilih.
 *
 * CATATAN PERBAIKAN: file ini sempat tertimpa salinan `VisitorForm` —
 * isinya komponen form tanpa props, padahal `QueuePage.tsx` memanggilnya
 * sebagai `<QueueDisplay visitor={visitor} />`. Akibatnya layar antrean
 * praktis rusak: pengunjung yang selesai memesan justru melihat formulir
 * kosong. Ditulis ulang di sini, memakai kunci terjemahan yang memang
 * sudah disiapkan untuk layar ini di `LanguageContext.tsx`.
 *
 * Nama tiket dibaca lewat `resolveSnapshot()` — SNAPSHOT per bahasa yang
 * dibekukan backend saat transaksi dibuat, bukan katalog terbaru. Dengan
 * begitu struk pengunjung tidak ikut berubah kalau admin mengganti nama
 * tiket lima menit kemudian.
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
   * Rincian dikelompokkan per lokasi (master tiket) supaya pengunjung yang
   * membeli beberapa lantai bisa langsung melihat apa yang ia dapat di
   * masing-masing lokasi — bukan satu daftar panjang yang tercampur.
   */
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { name: string; quantity: number; subtotal: number }[]>();
    visitor.items.forEach((item) => {
      const { group, variant, full } = resolveSnapshot(item, language);
      const key = group || full;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({
        name: variant || full,
        quantity: item.quantity,
        subtotal: item.quantity * item.unit_price,
      });
    });
    return Array.from(groups.entries());
  }, [visitor.items, language]);

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

  const paymentLabel =
    visitor.payment_method === "qris"
      ? "QRIS"
      : visitor.payment_method === "cash"
      ? translations.cashPaymentLabel[language]
      : translations.creditDebitCard[language];

  const paymentInstruction =
    visitor.payment_method === "qris"
      ? translations.qrisInstruction[language]
      : visitor.payment_method === "cash"
      ? translations.cashInstruction[language]
      : translations.cardInstruction[language];

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
        {/* RINCIAN TIKET */}
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3 pb-2 border-b border-gray-200">
            {translations.ticketDetails[language]}
          </p>

          {groupedItems.length === 0 ? (
            <p className="text-gray-400 italic text-sm text-center py-4">{translations.noTicketData[language]}</p>
          ) : (
            <div className="space-y-4">
              {groupedItems.map(([groupName, items]) => (
                <div key={groupName}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-[#fb9418] shrink-0" />
                    <p className="text-black font-extrabold text-sm">{groupName}</p>
                  </div>
                  <div className="space-y-1.5 pl-4">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">
                          <span className="font-bold text-black">{item.quantity}×</span> {item.name}
                        </span>
                        <span className="font-medium text-gray-600 font-mono shrink-0 ml-3">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RINGKASAN */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 font-medium">{translations.totalVisitors[language]}</span>
            <span className="font-bold text-black">
              {totalPeople} {translations.people[language]}
            </span>
          </div>
          {totalTickets !== totalPeople && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 font-medium">{translations.ticketDetails[language]}</span>
              <span className="font-bold text-black">{totalTickets}</span>
            </div>
          )}
          <div className="flex justify-between items-end pt-3 mt-1 border-t border-gray-200">
            <span className="text-gray-800 font-bold">{translations.totalPayment[language]}</span>
            <span className="font-black text-2xl text-[#fb9418]">{formatCurrency(visitor.total_price)}</span>
          </div>
        </div>

        {/* METODE PEMBAYARAN & INSTRUKSINYA */}
        <div className="p-4 rounded-xl bg-orange-50/50 border border-orange-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              {translations.yourPaymentMethod[language]}
            </span>
            <span className="text-sm font-black text-[#fb9418]">{paymentLabel}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">{paymentInstruction}</p>
        </div>

        {/* INSTRUKSI UMUM */}
        <p className="text-xs text-gray-500 leading-relaxed text-center border-t border-gray-200 pt-5">
          {translations.queueInstruction[language]}
        </p>
      </div>
    </div>
  );
};

export default QueueDisplay;
