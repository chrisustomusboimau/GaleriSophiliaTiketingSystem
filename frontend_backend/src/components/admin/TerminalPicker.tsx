/**
 * TerminalPicker.tsx (src/components/admin) — BARU
 * ----------------------------------------------------
 * Pemilih METODE PEMBAYARAN SPESIFIK: daftar terminal yang dipilih kasir
 * saat membuka sesi kasirnya, plus opsi Tunai.
 *
 * Dipakai di TIGA tempat yang semuanya harus menampilkan daftar yang sama
 * persis: pop-up konfirmasi pembayaran, modal Tambah Manual, dan modal
 * Edit Transaksi. Tanpa komponen bersama, ketiganya cepat atau lambat
 * akan menampilkan pilihan yang berbeda.
 *
 * KENAPA TIDAK ADA RADIO "QRIS/EDC/Tunai" LEPAS LAGI: kategori sekarang
 * DITURUNKAN dari terminal yang dipilih. Kalau kasir bisa memilih
 * kategori dan terminal secara terpisah, cepat atau lambat akan ada
 * transaksi berkategori "QRIS" dengan detail "EDC 1" — dan laporan
 * rekonsiliasi langsung tidak bisa dipercaya.
 */

import React from "react";
import { PaymentMethod, PaymentTerminal } from "../../types";
import { PAYMENT_METHOD_LABEL } from "../../utils/formatters";

/**
 * Metode pembayaran yang dipilih kasir.
 * `terminalId === null` berarti Tunai tanpa terminal (uang di laci).
 */
export interface PaymentSelection {
  terminalId: string | null;
  category: PaymentMethod;
}

export const CASH_SELECTION: PaymentSelection = { terminalId: null, category: "cash" };

/** Nilai awal picker dari transaksi yang sudah ada. */
export function selectionFromTransaction(
  paymentTerminalId: string | null | undefined,
  paymentMethod: PaymentMethod | undefined
): PaymentSelection {
  if (paymentTerminalId) return { terminalId: paymentTerminalId, category: paymentMethod ?? "card" };
  return { terminalId: null, category: paymentMethod ?? "cash" };
}

const CATEGORY_ACCENT: Record<string, string> = {
  card: "bg-gray-800 text-white border-gray-700",
  qris: "bg-green-100 text-green-700 border-green-200",
  cash: "bg-amber-100 text-amber-800 border-amber-200",
};

interface TerminalPickerProps {
  terminals: PaymentTerminal[];
  value: PaymentSelection;
  onChange: (next: PaymentSelection) => void;
  disabled?: boolean;
  /** Nama radio group — wajib unik kalau ada dua picker di satu halaman. */
  name?: string;
}

const TerminalPicker: React.FC<TerminalPickerProps> = ({
  terminals,
  value,
  onChange,
  disabled = false,
  name = "payment-terminal",
}) => {
  // Opsi Tunai generik hanya ditawarkan kalau sesi kasir ini TIDAK punya
  // terminal berkategori tunai sendiri — kalau punya, dua baris "Tunai"
  // yang artinya sama hanya akan membingungkan kasir.
  const hasCashTerminal = terminals.some((t) => t.category === "cash");

  const isSelected = (terminalId: string | null) => value.terminalId === terminalId;

  return (
    <div className="space-y-2">
      {terminals.map((terminal) => (
        <label
          key={terminal.id}
          className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${
            isSelected(terminal.id)
              ? "border-[#fb9418] bg-orange-50 shadow-sm"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={isSelected(terminal.id)}
            onChange={() => onChange({ terminalId: terminal.id, category: terminal.category })}
            disabled={disabled}
            className="w-4 h-4 text-[#fb9418] border-gray-300 focus:ring-[#fb9418] shrink-0"
          />
          <span className="flex-1 min-w-0">
            <span className={`block text-sm font-bold truncate ${isSelected(terminal.id) ? "text-[#fb9418]" : "text-black"}`}>
              {terminal.name}
            </span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase shrink-0 ${CATEGORY_ACCENT[terminal.category]}`}>
            {PAYMENT_METHOD_LABEL[terminal.category] || terminal.category}
          </span>
        </label>
      ))}

      {!hasCashTerminal && (
        <label
          className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${isSelected(null) ? "border-[#fb9418] bg-orange-50 shadow-sm" : "border-gray-200 hover:bg-gray-50"}`}
        >
          <input
            type="radio"
            name={name}
            checked={isSelected(null)}
            onChange={() => onChange(CASH_SELECTION)}
            disabled={disabled}
            className="w-4 h-4 text-[#fb9418] border-gray-300 focus:ring-[#fb9418] shrink-0"
          />
          <span className="flex-1 min-w-0">
            <span className={`block text-sm font-bold ${isSelected(null) ? "text-[#fb9418]" : "text-black"}`}>Tunai</span>
            <span className="block text-[11px] text-gray-400">Tanpa terminal — uang diterima langsung.</span>
          </span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border uppercase shrink-0 ${CATEGORY_ACCENT.cash}`}>
            {PAYMENT_METHOD_LABEL.cash}
          </span>
        </label>
      )}

      {terminals.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r">
          Sesi kasir Anda tidak memiliki terminal EDC/QRIS. Hanya pembayaran tunai yang bisa dicatat. Untuk
          menambah terminal, tutup lalu buka kembali sesi kasir dan pilih terminalnya.
        </p>
      )}
    </div>
  );
};

export default TerminalPicker;
