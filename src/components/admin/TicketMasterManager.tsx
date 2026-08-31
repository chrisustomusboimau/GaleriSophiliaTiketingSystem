/**
 * TicketMasterManager.tsx (src/components/admin) — KOMPONEN BARU
 * ----------------------------------------------------
 * CRUD Master Tiket (mis. "Tiket Lantai 1") beserta Sub-Kategori
 * usia & harga (mis. "Dewasa" 22+, Rp150.000). Menggantikan seluruh
 * sistem harga hardcoded lama.
 *
 * UPDATE (perbaikan bug FK saat "hapus"): tombol "Hapus" sekarang benar-
 * benar melakukan SOFT DELETE (`is_active = false`) lewat backend, bukan
 * DELETE FROM — supaya master/varian yang sudah dipakai di riwayat
 * transaksi tidak lagi memicu ForeignKeyViolationError. Item yang
 * dinonaktifkan otomatis hilang dari pilihan tiket baru (sesi/kasir),
 * tapi admin bisa melihatnya lagi lewat toggle "Tampilkan Nonaktif" di
 * bawah, dan mengaktifkannya kembali kapan saja.
 *
 * RBAC: semua staf (admin/kasir/checker) bisa melihat; hanya admin
 * yang bisa membuat/mengubah/menonaktifkan/mengaktifkan kembali.
 *
 * UPDATE (nama multi-bahasa): nama master & nama varian sekarang diisi
 * per bahasa. Bahasa Indonesia dan English WAJIB; Mandarin opsional
 * (pengunjung berbahasa Mandarin otomatis melihat versi English kalau
 * dikosongkan). HARGA TETAP SATU NILAI UNIVERSAL — tidak ada harga
 * per-bahasa, dan tidak boleh ada.
 *
 * Daftar di bawah menampilkan nama English sebagai subteks di bawah nama
 * Indonesia. Itu disengaja: setelah migrasi, baris lama terisi nama
 * English "placeholder" yang identik dengan nama Indonesianya, dan
 * subteks inilah cara tercepat admin menemukan mana yang belum
 * diterjemahkan sungguhan.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "../../api/client";
import {
  LocaleCode,
  LocalizedNameInput,
  TicketMaster,
  TicketMasterPayload,
  TicketSubCategory,
  TicketSubCategoryPayload,
  UserRole,
} from "../../types";
import { formatCurrency } from "../../utils/formatters";

/** Definisi kolom input nama per bahasa — satu sumber untuk kedua modal. */
const NAME_FIELDS: { locale: LocaleCode; label: string; required: boolean; placeholderMaster: string; placeholderSub: string }[] = [
  { locale: "id", label: "Bahasa Indonesia", required: true,  placeholderMaster: 'Contoh: "Tiket Lantai 1"',  placeholderSub: "Contoh: Dewasa, Remaja, Anak" },
  { locale: "en", label: "English",          required: true,  placeholderMaster: 'Contoh: "Floor 1 Ticket"',  placeholderSub: "Contoh: Adult, Teen, Child" },
  { locale: "zh", label: "中文 (opsional)",   required: false, placeholderMaster: 'Contoh: "1层门票"',          placeholderSub: "Contoh: 成人、青少年、儿童" },
];

const emptyName: LocalizedNameInput = { id: "", en: "", zh: "" };

/**
 * Memvalidasi nama multi-bahasa sebelum dikirim. Backend tetap menjadi
 * gerbang sebenarnya (membalas 422 lewat app/i18n.py) — pemeriksaan di
 * sini semata-mata supaya admin dapat umpan balik langsung tanpa
 * menunggu perjalanan ke server.
 *
 * Mengembalikan pesan error, atau null kalau lolos.
 */
function validateName(name: LocalizedNameInput): string | null {
  if (!name.id?.trim()) return "Nama dalam Bahasa Indonesia wajib diisi.";
  if (!name.en?.trim()) return "Nama dalam Bahasa Inggris (English) wajib diisi.";
  return null;
}

/** Membuang locale kosong sebelum dikirim (mis. `zh` yang tidak diisi). */
function cleanName(name: LocalizedNameInput): LocalizedNameInput {
  return Object.fromEntries(
    Object.entries(name)
      .map(([locale, value]) => [locale, (value ?? "").trim()])
      .filter(([, value]) => value !== "")
  ) as LocalizedNameInput;
}

interface TicketMasterManagerProps {
  role: UserRole | null;
}

const emptyMasterForm: TicketMasterPayload = { name_i18n: { ...emptyName }, description: "" };
const emptySubForm: TicketSubCategoryPayload = { name_i18n: { ...emptyName }, min_age: 0, max_age: null, price: 0 };

const TicketMasterManager: React.FC<TicketMasterManagerProps> = ({ role }) => {
  const isAdmin = role === "admin";

  const [masters, setMasters] = useState<TicketMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Admin-only: tampilkan juga master/varian yang sudah dinonaktifkan.
  const [showInactive, setShowInactive] = useState(false);

  // Modal Master
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<TicketMaster | null>(null);
  const [masterForm, setMasterForm] = useState<TicketMasterPayload>(emptyMasterForm);
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  // Modal Sub-Kategori
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subMasterId, setSubMasterId] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<TicketSubCategory | null>(null);
  const [subForm, setSubForm] = useState<TicketSubCategoryPayload>(emptySubForm);
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const loadMasters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = isAdmin && showInactive ? "?include_inactive=true" : "";
      const data = await apiGet<TicketMaster[]>(`/ticket-masters${query}`);
      setMasters(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat master tiket.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, showInactive]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  // --- Master handlers ---
  const openCreateMaster = () => {
    setEditingMaster(null);
    setMasterForm(emptyMasterForm);
    setMasterError(null);
    setIsMasterModalOpen(true);
  };

  const openEditMaster = (m: TicketMaster) => {
    setEditingMaster(m);
    setMasterForm({
      // Sebar di atas emptyName supaya field bahasa yang belum pernah diisi
      // tetap jadi string kosong (bukan undefined) — input terkendali React.
      name_i18n: { ...emptyName, ...(m.name_i18n || { id: m.name, en: m.name }) },
      description: m.description || "",
    });
    setMasterError(null);
    setIsMasterModalOpen(true);
  };

  const handleSaveMaster = async () => {
    const nameError = validateName(masterForm.name_i18n);
    if (nameError) {
      setMasterError(nameError);
      return;
    }
    const payload = { ...masterForm, name_i18n: cleanName(masterForm.name_i18n) };
    try {
      setMasterSaving(true);
      setMasterError(null);
      if (editingMaster) {
        await apiPatch(`/ticket-masters/${editingMaster.id}`, payload);
      } else {
        await apiPost("/ticket-masters", { ...payload, sub_categories: [] });
      }
      setIsMasterModalOpen(false);
      await loadMasters();
    } catch (err) {
      setMasterError(err instanceof ApiError ? err.message : "Gagal menyimpan master tiket.");
    } finally {
      setMasterSaving(false);
    }
  };

  const handleToggleMasterActive = async (m: TicketMaster) => {
    if (m.is_active) {
      if (!window.confirm(`Nonaktifkan master tiket "${m.name}" beserta seluruh variannya?\n\nTiket ini akan hilang dari pilihan baru, tapi riwayat transaksi lama tetap aman dan bisa diaktifkan kembali kapan saja.`)) {
        return;
      }
      try {
        await apiDelete(`/ticket-masters/${m.id}`);
        await loadMasters();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menonaktifkan master tiket.");
      }
    } else {
      try {
        await apiPatch(`/ticket-masters/${m.id}`, { is_active: true });
        await loadMasters();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan kembali master tiket.");
      }
    }
  };

  // --- Sub-category handlers ---
  const openCreateSub = (masterId: string) => {
    setSubMasterId(masterId);
    setEditingSub(null);
    setSubForm(emptySubForm);
    setSubError(null);
    setIsSubModalOpen(true);
  };

  const openEditSub = (masterId: string, sub: TicketSubCategory) => {
    setSubMasterId(masterId);
    setEditingSub(sub);
    setSubForm({
      name_i18n: { ...emptyName, ...(sub.name_i18n || { id: sub.name, en: sub.name }) },
      min_age: sub.min_age,
      max_age: sub.max_age,
      price: sub.price,
    });
    setSubError(null);
    setIsSubModalOpen(true);
  };

  const handleSaveSub = async () => {
    const nameError = validateName(subForm.name_i18n);
    if (nameError) {
      setSubError(nameError);
      return;
    }
    if (subForm.max_age !== null && subForm.max_age !== undefined && subForm.max_age < subForm.min_age) {
      setSubError("Usia maksimal tidak boleh lebih kecil dari usia minimal.");
      return;
    }
    if (subForm.price < 0) {
      setSubError("Harga tidak boleh negatif.");
      return;
    }
    const payload = { ...subForm, name_i18n: cleanName(subForm.name_i18n) };
    try {
      setSubSaving(true);
      setSubError(null);
      if (editingSub) {
        await apiPatch(`/ticket-sub-categories/${editingSub.id}`, payload);
      } else if (subMasterId) {
        await apiPost(`/ticket-masters/${subMasterId}/sub-categories`, payload);
      }
      setIsSubModalOpen(false);
      await loadMasters();
    } catch (err) {
      setSubError(err instanceof ApiError ? err.message : "Gagal menyimpan sub-kategori.");
    } finally {
      setSubSaving(false);
    }
  };

  const handleToggleSubActive = async (sub: TicketSubCategory) => {
    if (sub.is_active) {
      if (!window.confirm(`Nonaktifkan varian "${sub.name}"?\n\nVarian ini akan hilang dari pilihan baru, tapi riwayat transaksi lama tetap aman dan bisa diaktifkan kembali kapan saja.`)) {
        return;
      }
      try {
        await apiDelete(`/ticket-sub-categories/${sub.id}`);
        await loadMasters();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menonaktifkan sub-kategori.");
      }
    } else {
      try {
        await apiPatch(`/ticket-sub-categories/${sub.id}`, { is_active: true });
        await loadMasters();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan kembali sub-kategori.");
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto text-black">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Master Tiket &amp; Harga</h3>
          <p className="text-gray-500 text-sm mt-1">Kelola lokasi/area tiket beserta varian usia dan harga.</p>
        </div>
        {isAdmin && (
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
              onClick={openCreateMaster}
              className="text-sm font-bold px-4 py-2.5 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2 active:scale-95"
            >
              <span className="text-lg leading-none">+</span> Master Tiket Baru
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 font-medium">Memuat master tiket...</div>
      ) : masters.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          Belum ada master tiket. {isAdmin && "Klik “Master Tiket Baru” untuk membuat yang pertama."}
        </div>
      ) : (
        <div className="space-y-4">
          {masters.map((m) => {
            const isExpanded = expandedId === m.id;
            return (
              <div key={m.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : m.id)}
                  className="w-full flex justify-between items-center px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-bold text-black flex items-center gap-2">
                      {m.name}
                      {!m.is_active && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300 uppercase tracking-wide">
                          Nonaktif
                        </span>
                      )}
                    </p>
                    {/* Nama English sebagai subteks — cara tercepat melihat
                        mana yang masih memakai placeholder hasil migrasi
                        (nama English identik dengan nama Indonesia). */}
                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                      EN: {m.name_i18n?.en || <span className="text-red-500 italic">belum diisi</span>}
                      {m.name_i18n?.zh && <span className="text-gray-400"> · 中文: {m.name_i18n.zh}</span>}
                    </p>
                    {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                    <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wide font-bold">
                      {m.sub_categories.length} varian
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <>
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditMaster(m);
                          }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-[#fb9418] hover:text-[#fb9418] transition-colors"
                        >
                          Edit
                        </span>
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMasterActive(m);
                          }}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                            m.is_active
                              ? "border-red-200 text-red-500 hover:bg-red-50"
                              : "border-green-200 text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {m.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </span>
                      </>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                          <th className="pb-2">Varian</th>
                          <th className="pb-2">Rentang Usia</th>
                          <th className="pb-2">Harga</th>
                          {isAdmin && <th className="pb-2 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {m.sub_categories.map((sc) => (
                          <tr key={sc.id} className={`border-t border-gray-200 ${!sc.is_active ? "opacity-60" : ""}`}>
                            <td className="py-2.5 font-bold text-black">
                              <span className="flex items-center gap-2">
                                {sc.name}
                                {!sc.is_active && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300 uppercase tracking-wide">
                                    Nonaktif
                                  </span>
                                )}
                              </span>
                              <span className="block text-[11px] font-medium text-gray-500 mt-0.5">
                                EN: {sc.name_i18n?.en || <span className="text-red-500 italic">belum diisi</span>}
                                {sc.name_i18n?.zh && <span className="text-gray-400"> · 中文: {sc.name_i18n.zh}</span>}
                              </span>
                            </td>
                            <td className="py-2.5 text-gray-600">
                              {sc.min_age}
                              {sc.max_age !== null && sc.max_age !== undefined ? ` – ${sc.max_age} thn` : "+ thn"}
                            </td>
                            <td className="py-2.5 font-bold text-[#fb9418]">{formatCurrency(sc.price)}</td>
                            {isAdmin && (
                              <td className="py-2.5 text-right space-x-2">
                                <button onClick={() => openEditSub(m.id, sc)} className="text-xs font-bold text-gray-500 hover:text-[#fb9418]">
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleToggleSubActive(sc)}
                                  className={`text-xs font-bold ${sc.is_active ? "text-red-400 hover:text-red-600" : "text-green-600 hover:text-green-700"}`}
                                >
                                  {sc.is_active ? "Nonaktifkan" : "Aktifkan"}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {m.sub_categories.length === 0 && (
                          <tr>
                            <td colSpan={isAdmin ? 4 : 3} className="py-4 text-center text-gray-400 italic">
                              Belum ada varian usia/harga.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    {isAdmin && (
                      <button
                        onClick={() => openCreateSub(m.id)}
                        className="mt-4 text-sm font-bold text-[#fb9418] hover:text-orange-600 flex items-center gap-1"
                      >
                        <span className="text-lg leading-none">+</span> Tambah Varian
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL MASTER */}
      {isMasterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">
                {editingMaster ? "Edit Master Tiket" : "Master Tiket Baru"}
              </h3>
              <button onClick={() => setIsMasterModalOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {masterError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{masterError}</div>}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  Nama Master Tiket
                  <span className="normal-case font-medium text-gray-400"> — diisi per bahasa yang dilihat pengunjung</span>
                </p>
                {NAME_FIELDS.map((field) => (
                  <div key={field.locale}>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={masterForm.name_i18n[field.locale] ?? ""}
                      onChange={(e) =>
                        setMasterForm((p) => ({
                          ...p,
                          name_i18n: { ...p.name_i18n, [field.locale]: e.target.value },
                        }))
                      }
                      placeholder={field.placeholderMaster}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Deskripsi (opsional)</label>
                <textarea
                  value={masterForm.description || ""}
                  onChange={(e) => setMasterForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm resize-none"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsMasterModalOpen(false)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg">
                Batal
              </button>
              <button
                onClick={handleSaveMaster}
                disabled={masterSaving}
                className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50"
              >
                {masterSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUB-KATEGORI */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">{editingSub ? "Edit Varian" : "Varian Baru"}</h3>
              <button onClick={() => setIsSubModalOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {subError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{subError}</div>}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  Nama Varian
                  <span className="normal-case font-medium text-gray-400"> — diisi per bahasa yang dilihat pengunjung</span>
                </p>
                {NAME_FIELDS.map((field) => (
                  <div key={field.locale}>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={subForm.name_i18n[field.locale] ?? ""}
                      onChange={(e) =>
                        setSubForm((p) => ({
                          ...p,
                          name_i18n: { ...p.name_i18n, [field.locale]: e.target.value },
                        }))
                      }
                      placeholder={field.placeholderSub}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Usia Minimal</label>
                  <input
                    type="number"
                    min={0}
                    value={subForm.min_age}
                    onChange={(e) => setSubForm((p) => ({ ...p, min_age: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                    Usia Maksimal <span className="normal-case text-gray-400 font-medium">(kosongkan jika tak terbatas)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={subForm.max_age ?? ""}
                    onChange={(e) => setSubForm((p) => ({ ...p, max_age: e.target.value === "" ? null : parseInt(e.target.value, 10) }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Harga (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={subForm.price}
                  onChange={(e) => setSubForm((p) => ({ ...p, price: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsSubModalOpen(false)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg">
                Batal
              </button>
              <button
                onClick={handleSaveSub}
                disabled={subSaving}
                className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50"
              >
                {subSaving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketMasterManager;
