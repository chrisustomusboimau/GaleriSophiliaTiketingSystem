/**
 * AgeCategoryManager.tsx (src/components/admin) — KOMPONEN BARU
 * ----------------------------------------------------
 * CRUD MASTER VARIAN KATEGORI USIA: "Anak (0–12)", "Dewasa (13+)", dst.
 *
 * KENAPA ADA: sebelumnya varian usia diketik ulang di setiap master tiket,
 * sehingga "Dewasa" di Lantai 1 dan "Dewasa" di Lantai 2 adalah dua baris
 * lepas yang gampang menyimpang — beda ejaan, beda rentang usia, dan
 * laporan per kategori usia jadi tidak bisa dijumlahkan. Sekarang varian
 * dibuat SEKALI di sini, lalu setiap master tiket hanya mengisi harganya.
 *
 * CATATAN PENTING soal edit: mengubah nama atau rentang usia di sini TIDAK
 * menulis ulang varian yang sudah menempel di master tiket — di sana
 * nilainya adalah snapshot yang sengaja dibekukan, supaya sesi yang sedang
 * berjalan dan laporan yang sudah dicetak tidak berubah diam-diam.
 * Peringatan ini juga ditampilkan ke admin di modal edit.
 *
 * RBAC: HANYA admin.
 */

import React, { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "../../api/client";
import { AgeCategory, AgeCategoryPayload } from "../../types";
import LocalizedNameFields, {
  cleanName,
  emptyName,
  toNameForm,
  validateName,
} from "./LocalizedNameFields";

const emptyForm: AgeCategoryPayload = { name_i18n: { ...emptyName }, min_age: 0, max_age: null };

/** "0 – 12 thn" / "13+ thn" — dipakai juga di form pembuatan master tiket. */
export function formatAgeRange(minAge: number, maxAge: number | null | undefined): string {
  return maxAge !== null && maxAge !== undefined ? `${minAge} – ${maxAge} thn` : `${minAge}+ thn`;
}

const AgeCategoryManager: React.FC = () => {
  const [categories, setCategories] = useState<AgeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgeCategory | null>(null);
  const [form, setForm] = useState<AgeCategoryPayload>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = showInactive ? "?include_inactive=true" : "";
      const data = await apiGet<AgeCategory[]>(`/age-categories${query}`);
      setCategories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat master varian usia.");
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (category: AgeCategory) => {
    setEditing(category);
    setForm({
      name_i18n: toNameForm(category.name_i18n, category.name),
      min_age: category.min_age,
      max_age: category.max_age,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const nameError = validateName(form.name_i18n);
    if (nameError) {
      setFormError(nameError);
      return;
    }
    if (form.max_age !== null && form.max_age !== undefined && form.max_age < form.min_age) {
      setFormError("Usia maksimal tidak boleh lebih kecil dari usia minimal.");
      return;
    }
    const payload = { ...form, name_i18n: cleanName(form.name_i18n) };
    try {
      setIsSaving(true);
      setFormError(null);
      if (editing) {
        await apiPatch(`/age-categories/${editing.id}`, payload);
      } else {
        await apiPost("/age-categories", payload);
      }
      setIsModalOpen(false);
      await loadCategories();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan varian usia.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (category: AgeCategory) => {
    if (category.is_active) {
      if (
        !window.confirm(
          `Nonaktifkan varian usia "${category.name}"?\n\n` +
            `Varian ini tidak akan ditawarkan lagi saat membuat master tiket baru. ` +
            `Master tiket & sesi yang sudah memakainya tetap berjalan seperti biasa.`
        )
      ) {
        return;
      }
      try {
        await apiDelete(`/age-categories/${category.id}`);
        await loadCategories();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menonaktifkan varian usia.");
      }
    } else {
      try {
        await apiPatch(`/age-categories/${category.id}`, { is_active: true });
        await loadCategories();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan kembali varian usia.");
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto text-black">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Master Varian Usia</h3>
          <p className="text-gray-500 text-sm mt-1">
            Daftar baku kategori usia. Setiap master tiket memakai varian yang sama dari sini — yang berbeda
            hanya harganya.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={`text-xs font-bold px-3 py-2.5 rounded-lg border transition-all ${
              showInactive ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {showInactive ? "Sembunyikan Nonaktif" : "Tampilkan Nonaktif"}
          </button>
          <button
            onClick={openCreate}
            className="text-sm font-bold px-4 py-2.5 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <span className="text-lg leading-none">+</span> Varian Usia Baru
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 font-medium">Memuat master varian usia...</div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          Belum ada varian usia. Buat dulu di sini (mis. Anak, Remaja, Dewasa) sebelum membuat master tiket.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Varian</th>
                <th className="px-4 py-3 text-left">Rentang Usia</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className={`border-t border-gray-100 hover:bg-gray-50/60 ${!c.is_active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-black">{c.name}</p>
                    {/* Nama English sebagai subteks — cara tercepat melihat mana
                        yang masih memakai placeholder hasil migrasi (nama
                        English identik dengan nama Indonesia). */}
                    <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                      EN: {c.name_i18n?.en || <span className="text-red-500 italic">belum diisi</span>}
                      {c.name_i18n?.zh && <span className="text-gray-400"> · 中文: {c.name_i18n.zh}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{formatAgeRange(c.min_age, c.max_age)}</td>
                  <td className="px-4 py-3">
                    {c.is_active ? (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full border bg-green-100 text-green-700 border-green-300">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full border bg-gray-100 text-gray-500 border-gray-300">
                        Nonaktif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-[#fb9418] hover:text-[#fb9418] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(c)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                        c.is_active
                          ? "border-red-200 text-red-500 hover:bg-red-50"
                          : "border-green-200 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {c.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT VARIAN USIA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">
                {editing ? "Edit Varian Usia" : "Varian Usia Baru"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {formError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{formError}</div>}

              {editing && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-xs rounded-r">
                  Perubahan di sini berlaku untuk master tiket yang dibuat <strong>setelah</strong> ini. Varian
                  yang sudah menempel di master tiket lama sengaja tidak ikut berubah, supaya sesi yang sedang
                  berjalan dan laporan yang sudah dicetak tetap konsisten.
                </div>
              )}

              <LocalizedNameFields
                title="Nama Varian Usia"
                value={form.name_i18n}
                onChange={(name_i18n) => setForm((p) => ({ ...p, name_i18n }))}
                placeholders={{
                  id: "Contoh: Dewasa, Remaja, Anak",
                  en: "Contoh: Adult, Teen, Child",
                  zh: "Contoh: 成人、青少年、儿童",
                }}
                disabled={isSaving}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Usia Minimum
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_age}
                    onChange={(e) => setForm((p) => ({ ...p, min_age: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    disabled={isSaving}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Usia Maksimum <span className="normal-case text-gray-400 font-medium">(kosongkan jika tak terbatas)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.max_age ?? ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, max_age: e.target.value === "" ? null : parseInt(e.target.value, 10) }))
                    }
                    disabled={isSaving}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
                className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgeCategoryManager;
