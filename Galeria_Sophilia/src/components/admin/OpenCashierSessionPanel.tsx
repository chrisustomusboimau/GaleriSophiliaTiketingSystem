/**
 * OpenCashierSessionPanel.tsx (src/components/admin) — BARU
 * ----------------------------------------------------
 * Langkah pertama gerbang "Buka Sesi Kasir" di halaman detail sesi:
 * kasir memilih TERMINAL PEMBAYARAN yang ada di mejanya untuk shift ini.
 *
 * KENAPA DI SINI, BUKAN DI PENGATURAN: terminal yang dipakai berubah dari
 * shift ke shift (EDC dipindah, QRIS meja 2 dipakai kasir lain). Menanyakannya
 * tepat saat kasir mulai bekerja adalah satu-satunya cara agar Metode
 * Pembayaran Detail di riwayat benar-benar mencerminkan alat yang dipakai.
 *
 * Pilihan di sini langsung membatasi pop-up konfirmasi pembayaran: kasir
 * tidak akan bisa menagih lewat EDC yang tidak ia centang.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, ApiError } from "../../api/client";
import { PaymentMethod, PaymentTerminal } from "../../types";
import { TERMINAL_CATEGORY_LABEL } from "../../utils/formatters";
import { useCashierSession } from "../../contexts/CashierSessionContext";

const CATEGORY_ORDER: PaymentMethod[] = ["card", "qris", "cash"];

interface OpenCashierSessionPanelProps {
  /** Dipanggil setelah sesi kasir berhasil dibuka. */
  onOpened?: () => void;
}

const OpenCashierSessionPanel: React.FC<OpenCashierSessionPanelProps> = ({ onOpened }) => {
  const { openCashierSession } = useCashierSession();

  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTerminals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Default endpoint sudah menyaring terminal yang dinonaktifkan —
      // alat yang sudah ditarik dari peredaran tidak boleh bisa dipilih.
      setTerminals(await apiGet<PaymentTerminal[]>("/payment-terminals"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat daftar terminal.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTerminals();
  }, [loadTerminals]);

  const grouped = useMemo(() => {
    const groups = new Map<PaymentMethod, PaymentTerminal[]>();
    CATEGORY_ORDER.forEach((c) => groups.set(c, []));
    terminals.forEach((t) => {
      if (!groups.has(t.category)) groups.set(t.category, []);
      groups.get(t.category)!.push(t);
    });
    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [terminals]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleOpen = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await openCashierSession(selectedIds);
      onOpened?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuka sesi kasir.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{error}</div>}

      {isLoading ? (
        <p className="text-sm text-gray-400 text-center py-6">Memuat daftar terminal...</p>
      ) : terminals.length === 0 ? (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 text-sm rounded-r">
          Belum ada terminal pembayaran terdaftar. Anda masih bisa membuka sesi kasir untuk melayani
          pembayaran <strong>tunai</strong>. Minta Admin mendaftarkan EDC/QRIS lewat menu
          <strong> Terminal Pembayaran</strong> bila diperlukan.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([category, items]) => (
            <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide bg-gray-50 border-b border-gray-200 text-gray-600">
                {TERMINAL_CATEGORY_LABEL[category] || category}
              </div>
              <div className="p-2">
                {items.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 px-2 py-2 rounded hover:bg-orange-50/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(t.id)}
                      onChange={() => toggle(t.id)}
                      disabled={isSaving}
                      className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418]"
                    />
                    <span className="text-sm text-black font-medium">{t.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-gray-400">
          {selectedIds.length > 0
            ? `${selectedIds.length} terminal dipilih.`
            : "Tanpa terminal, Anda hanya bisa mencatat pembayaran tunai."}
        </p>
        <button
          onClick={handleOpen}
          disabled={isSaving || isLoading}
          className="px-5 py-2.5 text-sm font-bold bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isSaving ? "Membuka..." : "Buka Sesi Kasir"}
        </button>
      </div>
    </div>
  );
};

export default OpenCashierSessionPanel;
