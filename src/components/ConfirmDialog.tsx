/**
 * ConfirmDialog.tsx (src/components) — KOMPONEN BARU, reusable
 * ----------------------------------------------------
 * Pengganti `window.confirm` untuk aksi berbahaya (hapus, dsb.). Kelebihan
 * dibanding `window.confirm`: bisa diberi gaya, bisa menampilkan status
 * "sedang memproses" selama request berjalan, dan dapat diakses
 * (role="alertdialog", Escape menutup, fokus awal di tombol AMAN).
 *
 * Dialog tidak menutup dirinya sendiri: pemanggil mengontrol `open` dan
 * menutupnya setelah `onConfirm` selesai. Selama `loading`, semua cara
 * menutup (Escape, Batal, klik latar) dinonaktifkan supaya request yang
 * sedang jalan tidak "yatim".
 */

import React, { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Boleh JSX supaya pemanggil bisa menebalkan nama item, dsb. */
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Warna merah untuk aksi destruktif. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Fokus awal ke "Batal": menekan Enter tanpa sengaja tidak menghapus apa pun.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        // Klik di latar (bukan di kartu) = batal.
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200"
      >
        <div className="p-6 flex gap-4">
          <div
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${
              danger ? "bg-red-100 text-red-600" : "bg-orange-100 text-[#fb9418]"
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-lg font-bold text-black">
              {title}
            </h3>
            <div id="confirm-dialog-message" className="mt-2 text-sm text-gray-600 leading-relaxed">
              {message}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-white font-bold rounded-lg shadow-md disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#fb9418] hover:bg-orange-500"
            }`}
          >
            {loading ? "Memproses..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
