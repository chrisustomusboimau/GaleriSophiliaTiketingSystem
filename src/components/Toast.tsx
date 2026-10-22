/**
 * Toast.tsx (src/components) — KOMPONEN BARU, reusable
 * ----------------------------------------------------
 * Notifikasi singkat di bawah layar. Tampilannya sama dengan `Toast` lokal
 * di AdminDashboard.tsx; bedanya di sini ia bisa dipakai di mana saja dan
 * menghilang sendiri (auto-dismiss) lewat hook `useToast`.
 *
 * Pemakaian:
 *   const { toast, showToast } = useToast();
 *   showToast("Tersimpan.");                 // sukses
 *   showToast("Gagal menyimpan.", "error");  // error (tampil lebih lama)
 *   ...
 *   <Toast toast={toast} />
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

export type ToastType = "success" | "error";

export interface ToastState {
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, type });
    // Error tampil lebih lama: pesannya biasanya panjang & perlu dibaca.
    timer.current = setTimeout(() => setToast(null), type === "error" ? 6000 : 3500);
  }, []);

  // Bersihkan timer saat komponen pemakai di-unmount (hindari setState setelah unmount).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { toast, showToast };
}

export const Toast: React.FC<{ toast: ToastState | null }> = ({ toast }) => {
  if (!toast) return null;
  const isSuccess = toast.type === "success";
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div
        // role="alert" membacakan error segera ke screen reader; "status" bersifat sopan.
        role={isSuccess ? "status" : "alert"}
        className={`flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-md ${
          isSuccess ? "bg-black/90 text-[#fb9418] border-[#fb9418]" : "bg-red-600 text-white border-red-400"
        }`}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
            d={isSuccess ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"}
          />
        </svg>
        <span className="font-bold tracking-wide text-sm">{toast.message}</span>
      </div>
    </div>
  );
};
