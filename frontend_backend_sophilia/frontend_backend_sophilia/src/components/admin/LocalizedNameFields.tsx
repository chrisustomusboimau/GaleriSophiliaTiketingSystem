/**
 * LocalizedNameFields.tsx (src/components/admin) — BARU
 * ----------------------------------------------------
 * Blok input "nama per bahasa" yang dipakai bersama oleh SEMUA form
 * master data: Master Tiket dan Master Varian Usia.
 *
 * Diekstrak dari `TicketMasterManager.tsx` saat Master Varian Usia
 * ditambahkan — aturannya (Indonesia & English wajib, Mandarin opsional)
 * ditegakkan backend di satu tempat (`app/i18n.py`), jadi versi
 * kliennya juga harus satu tempat. Kalau tidak, dua form akan pelan-pelan
 * memvalidasi hal yang sedikit berbeda.
 */

import React from "react";
import { LocaleCode, LocalizedNameInput } from "../../types";

/** Definisi kolom input nama per bahasa — satu sumber untuk semua form. */
export const NAME_LOCALES: { locale: LocaleCode; label: string; required: boolean }[] = [
  { locale: "id", label: "Bahasa Indonesia", required: true },
  { locale: "en", label: "English", required: true },
  { locale: "zh", label: "中文 (opsional)", required: false },
];

/** Nilai awal form: string kosong untuk semua bahasa (input terkendali React). */
export const emptyName: LocalizedNameInput = { id: "", en: "", zh: "" };

/**
 * Memvalidasi nama multi-bahasa sebelum dikirim. Backend tetap menjadi
 * gerbang sebenarnya (membalas 422 lewat app/i18n.py) — pemeriksaan di
 * sini semata-mata supaya admin dapat umpan balik langsung tanpa
 * menunggu perjalanan ke server.
 *
 * Mengembalikan pesan error, atau null kalau lolos.
 */
export function validateName(name: LocalizedNameInput): string | null {
  if (!name.id?.trim()) return "Nama dalam Bahasa Indonesia wajib diisi.";
  if (!name.en?.trim()) return "Nama dalam Bahasa Inggris (English) wajib diisi.";
  return null;
}

/** Membuang locale kosong sebelum dikirim (mis. `zh` yang tidak diisi). */
export function cleanName(name: LocalizedNameInput): LocalizedNameInput {
  return Object.fromEntries(
    Object.entries(name)
      .map(([locale, value]) => [locale, (value ?? "").trim()])
      .filter(([, value]) => value !== "")
  ) as LocalizedNameInput;
}

/**
 * Menyiapkan nilai form dari data yang sudah tersimpan. Disebar di atas
 * `emptyName` supaya bahasa yang belum pernah diisi tetap string kosong
 * (bukan undefined) — kalau tidak, React menganggap input-nya berubah
 * dari uncontrolled jadi controlled dan melempar peringatan.
 */
export function toNameForm(
  name_i18n: LocalizedNameInput | undefined | null,
  fallbackName: string
): LocalizedNameInput {
  return { ...emptyName, ...(name_i18n || { id: fallbackName, en: fallbackName }) };
}

interface LocalizedNameFieldsProps {
  /** Judul blok, mis. "Nama Master Tiket" atau "Nama Varian Usia". */
  title: string;
  value: LocalizedNameInput;
  onChange: (next: LocalizedNameInput) => void;
  /** Contoh isian per bahasa, mis. { id: 'Contoh: "Dewasa"', ... }. */
  placeholders?: Partial<Record<LocaleCode, string>>;
  disabled?: boolean;
}

const LocalizedNameFields: React.FC<LocalizedNameFieldsProps> = ({
  title,
  value,
  onChange,
  placeholders = {},
  disabled = false,
}) => (
  <div className="space-y-3">
    <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
      {title}
      <span className="normal-case font-medium text-gray-400"> — diisi per bahasa yang dilihat pengunjung</span>
    </p>
    {NAME_LOCALES.map((field) => (
      <div key={field.locale}>
        <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={value[field.locale] ?? ""}
          onChange={(e) => onChange({ ...value, [field.locale]: e.target.value })}
          placeholder={placeholders[field.locale]}
          disabled={disabled}
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm disabled:bg-gray-100"
        />
      </div>
    ))}
  </div>
);

export default LocalizedNameFields;
