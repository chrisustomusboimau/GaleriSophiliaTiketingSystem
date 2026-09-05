/**
 * TicketMasterManager.tsx (src/components/admin)
 * ----------------------------------------------------
 * CRUD Master Tiket (mis. "Tiket Lantai 1") beserta HARGA per varian usia.
 *
 * UBAH BESAR (v2) — VARIAN TIDAK LAGI DIKETIK MANUAL DI SINI.
 * Dulu setiap master tiket mendefinisikan variannya sendiri: admin
 * mengetik nama ("Dewasa"), usia minimum, usia maksimum, dan harga —
 * berulang kali, untuk setiap lantai. Akibatnya "Dewasa" di Lantai 1 dan
 * "Dewasa" di Lantai 2 adalah dua baris lepas yang gampang menyimpang,
 * dan laporan per kategori usia tidak bisa dijumlahkan dengan yakin.
 *
 * Sekarang daftar varian ter-generate otomatis dari MASTER VARIAN USIA
 * (tab "Varian Usia" / `AgeCategoryManager`). Yang tersisa di layar ini
 * murni urusan HARGA: admin mencentang varian yang dijual di lokasi ini,
 * lalu mengisi nominalnya.
 *
 * Sisa perilaku lama TIDAK berubah:
 * - "Hapus" adalah SOFT DELETE (`is_active = false`) — master/varian yang
 *   sudah dipakai riwayat transaksi tidak pernah benar-benar dihapus, dan
 *   bisa diaktifkan kembali lewat toggle "Tampilkan Nonaktif".
 * - Nama master tetap multi-bahasa (ID & EN wajib, ZH opsional); nama
 *   English ditampilkan sebagai subteks supaya sisa placeholder hasil
 *   migrasi mudah dikenali.
 * - RBAC: semua staf bisa melihat; hanya admin yang bisa mengubah.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "../../api/client";
import {
  AgeCategory,
  TicketMaster,
  TicketMasterPayload,
  TicketSubCategory,
  UserRole,
} from "../../types";
import { formatCurrency } from "../../utils/formatters";
import LocalizedNameFields, { cleanName, emptyName, toNameForm, validateName } from "./LocalizedNameFields";
import { formatAgeRange } from "./AgeCategoryManager";

interface TicketMasterManagerProps {
  role: UserRole | null;
}

const emptyMasterForm: TicketMasterPayload = { name_i18n: { ...emptyName }, description: "" };

/** Satu baris harga pada form pembuatan master tiket. */
interface PriceRow {
  /** Dicentang = varian ini dijual di master tiket ini. */
  selected: boolean;
  /** String (bukan number) supaya field bisa dikosongkan saat mengetik. */
  price: string;
}

const TicketMasterManager: React.FC<TicketMasterManagerProps> = ({ role }) => {
  const isAdmin = role === "admin";

  const [masters, setMasters] = useState<TicketMaster[]>([]);
  const [ageCategories, setAgeCategories] = useState<AgeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Admin-only: tampilkan juga master/varian yang sudah dinonaktifkan.
  const [showInactive, setShowInactive] = useState(false);

  // Modal Master (buat / edit)
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<TicketMaster | null>(null);
  const [masterForm, setMasterForm] = useState<TicketMasterPayload>(emptyMasterForm);
  const [priceRows, setPriceRows] = useState<Record<string, PriceRow>>({});
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  // Modal Varian (tambah varian ke master yang sudah ada / ubah harganya)
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subMasterId, setSubMasterId] = useState<string | null>(null);
  const [editingSub, setEditingSub] = useState<TicketSubCategory | null>(null);
  const [subAgeCategoryId, setSubAgeCategoryId] = useState<string>("");
  const [subPrice, setSubPrice] = useState<string>("0");
  const [subSaving, setSubSaving] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = isAdmin && showInactive ? "?include_inactive=true" : "";
      const [masterData, ageData] = await Promise.all([
        apiGet<TicketMaster[]>(`/ticket-masters${query}`),
        apiGet<AgeCategory[]>("/age-categories"),
      ]);
      setMasters(masterData);
      setAgeCategories(ageData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat master tiket.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, showInactive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* =====================================================
     MASTER TIKET
  ===================================================== */

  const openCreateMaster = () => {
    setEditingMaster(null);
    setMasterForm(emptyMasterForm);
    // Semua varian dicentang secara default: kasus yang paling lazim
    // adalah satu lantai menjual seluruh kategori usia. Admin tinggal
    // membuang yang tidak dijual, bukan mencentang satu per satu.
    setPriceRows(
      Object.fromEntries(ageCategories.map((c) => [c.id, { selected: true, price: "0" }]))
    );
    setMasterError(null);
    setIsMasterModalOpen(true);
  };

  const openEditMaster = (m: TicketMaster) => {
    setEditingMaster(m);
    setMasterForm({
      name_i18n: toNameForm(m.name_i18n, m.name),
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
        // Edit master hanya menyentuh nama & deskripsi. Harga per varian
        // diubah dari daftar varian di bawah kartu master.
        await apiPatch(`/ticket-masters/${editingMaster.id}`, payload);
      } else {
        const selected = Object.entries(priceRows).filter(([, row]) => row.selected);
        if (selected.length === 0) {
          setMasterError("Pilih setidaknya satu varian usia yang dijual pada master tiket ini.");
          return;
        }
        const invalid = selected.find(([, row]) => row.price.trim() === "" || Number(row.price) < 0);
        if (invalid) {
          setMasterError("Harga setiap varian yang dipilih wajib diisi dan tidak boleh negatif.");
          return;
        }
        await apiPost("/ticket-masters", {
          ...payload,
          sub_categories: selected.map(([ageCategoryId, row]) => ({
            age_category_id: ageCategoryId,
            price: Number(row.price) || 0,
          })),
        });
      }
      setIsMasterModalOpen(false);
      await loadData();
    } catch (err) {
      setMasterError(err instanceof ApiError ? err.message : "Gagal menyimpan master tiket.");
    } finally {
      setMasterSaving(false);
    }
  };

  const handleToggleMasterActive = async (m: TicketMaster) => {
    if (m.is_active) {
      if (
        !window.confirm(
          `Nonaktifkan master tiket "${m.name}" beserta seluruh variannya?\n\nTiket ini akan hilang dari pilihan baru, tapi riwayat transaksi lama tetap aman dan bisa diaktifkan kembali kapan saja.`
        )
      ) {
        return;
      }
      try {
        await apiDelete(`/ticket-masters/${m.id}`);
        await loadData();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menonaktifkan master tiket.");
      }
    } else {
      try {
        await apiPatch(`/ticket-masters/${m.id}`, { is_active: true });
        await loadData();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan kembali master tiket.");
      }
    }
  };

  /* =====================================================
     VARIAN (HARGA) PADA SATU MASTER
  ===================================================== */

  /** Varian usia yang BELUM dipakai master ini — kandidat untuk ditambahkan. */
  const availableAgeCategories = useMemo(() => {
    if (!subMasterId) return [];
    const master = masters.find((m) => m.id === subMasterId);
    const used = new Set((master?.sub_categories ?? []).map((sc) => sc.age_category_id).filter(Boolean));
    return ageCategories.filter((c) => c.is_active && !used.has(c.id));
  }, [subMasterId, masters, ageCategories]);

  const openCreateSub = (masterId: string) => {
    setSubMasterId(masterId);
    setEditingSub(null);
    setSubAgeCategoryId("");
    setSubPrice("0");
    setSubError(null);
    setIsSubModalOpen(true);
  };

  const openEditSub = (masterId: string, sub: TicketSubCategory) => {
    setSubMasterId(masterId);
    setEditingSub(sub);
    setSubAgeCategoryId(sub.age_category_id || "");
    setSubPrice(String(sub.price));
    setSubError(null);
    setIsSubModalOpen(true);
  };

  const handleSaveSub = async () => {
    const price = Number(subPrice);
    if (subPrice.trim() === "" || Number.isNaN(price) || price < 0) {
      setSubError("Harga wajib diisi dan tidak boleh negatif.");
      return;
    }
    if (!editingSub && !subAgeCategoryId) {
      setSubError("Pilih varian usia terlebih dahulu.");
      return;
    }
    try {
      setSubSaving(true);
      setSubError(null);
      if (editingSub) {
        // Hanya harga — nama & rentang usia milik master varian usia.
        await apiPatch(`/ticket-sub-categories/${editingSub.id}`, { price });
      } else if (subMasterId) {
        await apiPost(`/ticket-masters/${subMasterId}/sub-categories`, {
          age_category_id: subAgeCategoryId,
          price,
        });
      }
      setIsSubModalOpen(false);
      await loadData();
    } catch (err) {
      setSubError(err instanceof ApiError ? err.message : "Gagal menyimpan varian.");
    } finally {
      setSubSaving(false);
    }
  };

  const handleToggleSubActive = async (sub: TicketSubCategory) => {
    if (sub.is_active) {
      if (
        !window.confirm(
          `Nonaktifkan varian "${sub.name}"?\n\nVarian ini akan hilang dari pilihan baru, tapi riwayat transaksi lama tetap aman dan bisa diaktifkan kembali kapan saja.`
        )
      ) {
        return;
      }
      try {
        await apiDelete(`/ticket-sub-categories/${sub.id}`);
        await loadData();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menonaktifkan varian.");
      }
    } else {
      try {
        await apiPatch(`/ticket-sub-categories/${sub.id}`, { is_active: true });
        await loadData();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan kembali varian.");
      }
    }
  };

  /* =====================================================
     RENDER
  ===================================================== */

  const noAgeCategories = ageCategories.length === 0;

  return (
    <div className="w-full max-w-6xl mx-auto text-black">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Master Tiket &amp; Harga</h3>
          <p className="text-gray-500 text-sm mt-1">
            Kelola lokasi/area tiket. Varian usianya baku dari tab “Varian Usia” — di sini Anda hanya
            menentukan harganya.
          </p>
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
              disabled={noAgeCategories}
              title={noAgeCategories ? "Buat dulu minimal satu varian usia di tab “Varian Usia”." : undefined}
              className="text-sm font-bold px-4 py-2.5 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="text-lg leading-none">+</span> Master Tiket Baru
            </button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{error}</div>}

      {isAdmin && noAgeCategories && !isLoading && (
        <div className="mb-4 p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-sm rounded-r shadow-sm">
          Belum ada <strong>varian usia</strong>. Buka tab <strong>“Varian Usia”</strong> dan buat minimal satu
          (mis. Anak, Dewasa) — master tiket mengambil variannya dari sana.
        </div>
      )}

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
                          <th className="pb-2">Varian Usia</th>
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
                                {/* Varian legacy yang tidak menemukan padanan
                                    saat migrasi — perlu ditautkan ulang admin
                                    supaya laporan lintas-lantai konsisten. */}
                                {!sc.age_category_id && (
                                  <span
                                    title="Varian ini belum tertaut ke Master Varian Usia. Nonaktifkan lalu tambahkan ulang dari daftar varian baku."
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide"
                                  >
                                    Belum tertaut
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="py-2.5 text-gray-600 font-mono">{formatAgeRange(sc.min_age, sc.max_age)}</td>
                            <td className="py-2.5 font-bold text-[#fb9418]">{formatCurrency(sc.price)}</td>
                            {isAdmin && (
                              <td className="py-2.5 text-right space-x-2">
                                <button
                                  onClick={() => openEditSub(m.id, sc)}
                                  className="text-xs font-bold text-gray-500 hover:text-[#fb9418]"
                                >
                                  Ubah Harga
                                </button>
                                <button
                                  onClick={() => handleToggleSubActive(sc)}
                                  className={`text-xs font-bold ${
                                    sc.is_active ? "text-red-400 hover:text-red-600" : "text-green-600 hover:text-green-700"
                                  }`}
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
                              Belum ada varian usia yang diberi harga.
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
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {masterError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{masterError}</div>}

              <LocalizedNameFields
                title="Nama Master Tiket"
                value={masterForm.name_i18n}
                onChange={(name_i18n) => setMasterForm((p) => ({ ...p, name_i18n }))}
                placeholders={{
                  id: 'Contoh: "Tiket Lantai 1"',
                  en: 'Contoh: "Floor 1 Ticket"',
                  zh: 'Contoh: "1层门票"',
                }}
                disabled={masterSaving}
              />

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={masterForm.description || ""}
                  onChange={(e) => setMasterForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  disabled={masterSaving}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm resize-none"
                />
              </div>

              {/* Harga per varian — HANYA saat membuat master baru. Saat
                  mengedit, harga diubah dari daftar varian di kartu master
                  supaya tidak ada dua tempat yang mengubah hal yang sama. */}
              {!editingMaster && (
                <div>
                  <p className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                    Harga per Varian Usia
                  </p>
                  <p className="text-[11px] text-gray-400 mb-3">
                    Daftar varian di bawah baku dari tab “Varian Usia”. Hilangkan centang untuk varian yang
                    tidak dijual di lokasi ini.
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {ageCategories.map((c) => {
                      const row = priceRows[c.id] ?? { selected: false, price: "0" };
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            row.selected ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              setPriceRows((p) => ({ ...p, [c.id]: { ...row, selected: e.target.checked } }))
                            }
                            disabled={masterSaving}
                            className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418] shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-black truncate">{c.name}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{formatAgeRange(c.min_age, c.max_age)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-bold text-gray-400">Rp</span>
                            <input
                              type="number"
                              min={0}
                              value={row.price}
                              onChange={(e) => setPriceRows((p) => ({ ...p, [c.id]: { ...row, price: e.target.value } }))}
                              onFocus={(e) => e.target.select()}
                              disabled={masterSaving || !row.selected}
                              className="w-28 p-2 border border-gray-300 rounded-lg text-sm font-bold text-black text-right focus:ring-2 focus:ring-[#fb9418] outline-none disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {ageCategories.length === 0 && (
                      <p className="text-sm text-gray-400 italic">
                        Belum ada varian usia. Buat dulu di tab “Varian Usia”.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsMasterModalOpen(false)}
                disabled={masterSaving}
                className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg"
              >
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

      {/* MODAL VARIAN (tambah varian / ubah harga) */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">
                {editingSub ? "Ubah Harga Varian" : "Tambah Varian"}
              </h3>
              <button onClick={() => setIsSubModalOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {subError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{subError}</div>}

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                  Varian Usia
                </label>

                {editingSub ? (
                  // Saat mengedit, varian tidak bisa diganti — mengganti
                  // varian sama saja dengan menghapus lalu menambah yang
                  // baru, dan itu akan memutus tautan harga di riwayat.
                  <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg">
                    <p className="text-sm font-bold text-black">{editingSub.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      {formatAgeRange(editingSub.min_age, editingSub.max_age)}
                    </p>
                  </div>
                ) : (
                  <>
                    <select
                      value={subAgeCategoryId}
                      onChange={(e) => setSubAgeCategoryId(e.target.value)}
                      disabled={subSaving || availableAgeCategories.length === 0}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm cursor-pointer disabled:bg-gray-100"
                    >
                      <option value="">— Pilih varian usia —</option>
                      {availableAgeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({formatAgeRange(c.min_age, c.max_age)})
                        </option>
                      ))}
                    </select>
                    {availableAgeCategories.length === 0 && (
                      <p className="text-[11px] text-amber-700 mt-1.5">
                        Semua varian usia yang aktif sudah dipakai master tiket ini. Buat varian baru di tab
                        “Varian Usia” kalau memang perlu.
                      </p>
                    )}
                  </>
                )}

                <p className="text-[11px] text-gray-400 mt-1.5">
                  Nama &amp; rentang usia dikelola di tab “Varian Usia” — berlaku untuk semua master tiket.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Harga (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={subPrice}
                  onChange={(e) => setSubPrice(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  disabled={subSaving}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsSubModalOpen(false)}
                disabled={subSaving}
                className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleSaveSub}
                disabled={subSaving || (!editingSub && availableAgeCategories.length === 0)}
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
