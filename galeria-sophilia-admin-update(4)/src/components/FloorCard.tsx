/**
 * FloorCard.tsx
 * ----------------------------------------------------
 * Kartu pilihan "lantai" (Master Tiket) di TicketSelectionPage.
 *
 * UPDATE (selaras backend baru): sebelumnya harga per lantai hardcoded ke
 * TEPAT 3 kategori tetap (adult/student/child). Sekarang jumlah & nama
 * varian usia sepenuhnya dinamis — apa pun yang dikonfigurasi admin di
 * Master Data (bisa 2, 3, 5 varian, nama apa saja), diambil langsung dari
 * sesi operasional yang sedang aktif.
 */

import React from "react";
import { formatCurrency } from "../utils/formatters";

export interface FloorVariant {
  /** id sub-kategori tiket (dipakai kalau nanti perlu, saat ini hanya untuk key React) */
  id: string;
  name: string;
  price: number;
}

export interface FloorData {
  /** ticket_master_id sungguhan — dikirim ke VisitorForm sebagai selectedFloors */
  id: string;
  label: string;
  variants: FloorVariant[];
}

interface FloorCardProps {
  floor: FloorData;
  isSelected: boolean;
  onToggle: (id: string) => void;
  perPersonLabel: string;
}

const FloorCard: React.FC<FloorCardProps> = ({ floor, isSelected, onToggle, perPersonLabel }) => {
  return (
    <button
      onClick={() => onToggle(floor.id)}
      className={`w-full p-6 rounded-xl border-2 text-left transition-all duration-200 ${
        isSelected
          ? "border-[#fb9418] bg-orange-50 shadow-md scale-[1.02]"
          : "border-gray-200 bg-white hover:border-[#fb9418]"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className={`text-xl font-bold ${isSelected ? "text-[#fb9418]" : "text-black"}`}>{floor.label}</h3>

        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors shrink-0 ${
            isSelected ? "bg-[#fb9418] border-[#fb9418] text-[#fcfcfc]" : "border-gray-300 bg-white"
          }`}
        >
          {isSelected && <span className="font-bold">✓</span>}
        </div>
      </div>

      <div className="bg-white/60 p-3 rounded-lg border border-gray-100 space-y-2">
        {floor.variants.map((v) => (
          <div key={v.id} className="flex justify-between text-sm">
            <span className="text-gray-600 font-medium">{v.name}</span>
            <span className="font-bold text-black">
              {formatCurrency(v.price)} <span className="text-gray-400 font-normal text-xs">/ {perPersonLabel}</span>
            </span>
          </div>
        ))}
        {floor.variants.length === 0 && <p className="text-xs text-gray-400 italic">-</p>}
      </div>
    </button>
  );
};

export default FloorCard;
