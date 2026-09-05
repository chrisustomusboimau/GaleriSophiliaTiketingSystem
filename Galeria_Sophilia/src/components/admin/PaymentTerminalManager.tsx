/**
 * PaymentTerminalManager.tsx (src/components/admin) — KOMPONEN BARU
 * ----------------------------------------------------
 * CRUD Terminal Pembayaran: "EDC 1", "EDC 2", "QRIS Meja 1", dst.
 *
 * Daftar inilah yang muncul saat kasir membuka sesi kasirnya, dan dari
 * sesi kasir itulah pilihan metode pembayaran spesifik pada pop-up
 * konfirmasi berasal. Jadi menonaktifkan terminal di sini langsung
 * menghentikannya dipakai menagih, tanpa merusak riwayat lama.
 *
 * RBAC: HANYA admin (tab ini hanya ada di /admin, dan endpoint tulis di
 * backend sendiri sudah menolak non-admin).
 *
 * "Hapus" di sini adalah SOFT DELETE (`is_active = false`), pola yang
 * sama persis dengan Master Tiket: transaksi lama menyimpan
 * `payment_terminal_id`, jadi baris terminal tidak boleh benar-benar
 * hilang dari database.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "../../api/client";
import { PaymentMethod, PaymentTerminal, PaymentTerminalPayload } from "../../types";
import { TERMINAL_CATEGORY_LABEL } from "../../utils/formatters";

const CATEGORY_OPTIONS: PaymentMethod[] = ["card", "qris", "cash"];

const CATEGORY_BADGE: Record<string, string> = {
  card: "bg-gray-800 text-white border-gray-700",
  qris: "bg-green-100 text-green-700 border-green-200",
  cash: "bg-amber-100 text-amber-800 border-amber-200",
};

const emptyForm: PaymentTerminalPayload = { name: "", category: "card" };

const PaymentTerminalManager: React.FC = () => {
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentTerminal | null>(null);
  const [form, setForm] = useState<PaymentTerminalPayload>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTerminals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const query = showInactive ? "?include_inactive=true" : "";
      const data = await apiGet<PaymentTerminal[]>(`/payment-terminals${query}`);
      setTerminals(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat terminal pembayaran.");
    } finally {
      setIsLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    loadTerminals();
  }, [loadTerminals]);

  // Dikelompokkan per kategori supaya "semua EDC" dan "semua QRIS" bisa
  // dilihat sekaligus — itulah cara staf memikirkan alat-alat ini.
  const grouped = useMemo(() => {
    const groups = new Map<PaymentMethod, PaymentTerminal[]>();
    CATEGORY_OPTIONS.forEach((c) => groups.set(c, []));
    terminals.forEach((t) => {
      if (!groups.has(t.category)) groups.set(t.category, []);
      groups.get(t.category)!.push(t);
    });
    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [terminals]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (terminal: PaymentTerminal) => {
    setEditing(terminal);
    setForm({ name: terminal.name, category: terminal.category });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError("Nama terminal wajib diisi.");
      return;
    }
    try {
      setIsSaving(true);
      setFormError(null);
      const payload = { name: form.name.trim(), category: form.category };
      if (editing) {
        await apiPatch(`/payment-terminals/${editing.id}`, payload);
      } else {
        await apiPost("/payment-terminals", payload);
      }
      setIsModalOpen(false);
      await loadTerminals();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan terminal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (terminal: PaymentTerminal) => {
    if (terminal.is_active) {
      if (
        !window.confirm(
          `Nonaktifkan terminal "${terminal.name}"?\n\n` +
            `Terminal ini akan hilang dari pilihan saat kasir membuka sesi, ` +
            `tapi transaksi lama yang memakainya tetap utuh dan bisa diaktifkan kembali kapan saja.`
        )
      ) {
        return;
      }
      try {
        await apiDelete(`/payment-terminals/${terminal.id}`);
        await loadTerminals();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal menonaktifkan terminal.");
      }
    } else {
      try {
        await apiPatch(`/payment-terminals/${terminal.id}`, { is_active: true });
        await loadTerminals();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal mengaktifkan kembali terminal.");
      }
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto text-black">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Terminal Pembayaran</h3>
          <p className="text-gray-500 text-sm mt-1">
            Daftar mesin EDC &amp; QRIS di lokasi. Kasir memilih terminal miliknya saat membuka sesi kasir.
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
            <span className="text-lg leading-none">+</span> Terminal Baru
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 font-medium">Memuat terminal pembayaran...</div>
      ) : terminals.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          Belum ada terminal pembayaran. Klik “Terminal Baru” untuk mendaftarkan EDC atau QRIS pertama.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <div key={category} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-1 rounded-full border uppercase ${CATEGORY_BADGE[category]}`}>
                  {TERMINAL_CATEGORY_LABEL[category] || category}
                </span>
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wide">{items.length} terminal</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className={`border-t border-gray-100 hover:bg-gray-50/60 ${!t.is_active ? "opacity-60" : ""}`}>
                      <td className="px-5 py-3 font-bold text-black">
                        <span className="flex items-center gap-2">
                          {t.name}
                          {!t.is_active && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300 uppercase tracking-wide">
                              Nonaktif
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right space-x-2">
                        <button
                          onClick={() => openEdit(t)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-[#fb9418] hover:text-[#fb9418] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(t)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                            t.is_active
                              ? "border-red-200 text-red-500 hover:bg-red-50"
                              : "border-green-200 text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {t.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT TERMINAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">
                {editing ? "Edit Terminal" : "Terminal Baru"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{formError}</div>}

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">
                  Nama Terminal
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder='Contoh: "EDC 1" atau "QRIS Meja 2"'
                  disabled={isSaving}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Nama ini yang muncul di pop-up konfirmasi kasir dan tercatat di riwayat transaksi.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Kategori</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as PaymentMethod }))}
                  disabled={isSaving}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm cursor-pointer"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {TERMINAL_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Kategori inilah yang tercatat sebagai Metode Pembayaran pada transaksi; nama terminal di atas
                  tercatat sebagai Metode Pembayaran Detail.
                </p>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
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

export default PaymentTerminalManager;
