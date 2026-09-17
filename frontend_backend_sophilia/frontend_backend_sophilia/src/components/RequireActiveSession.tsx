/**
 * RequireActiveSession.tsx — BARU
 * ----------------------------------------------------
 * Penjaga rute untuk alur PEMBELIAN publik, mengikuti pola yang sudah ada
 * di `ProtectedRoute.tsx` & `RequireRole.tsx` (render <Outlet /> kalau
 * lolos, <Navigate replace /> kalau tidak).
 *
 * ATURAN: pengunjung hanya boleh masuk halaman pemilihan tiket & form
 * pembelian kalau ADA sesi yang sedang berjalan tepat saat ini. Kalau
 * tidak, mereka dialihkan ke `/tickets-unavailable`.
 *
 * Keputusan "sedang berjalan" datang dari BACKEND (`is_live`), bukan dari
 * jam perangkat pengunjung — jam ponsel yang salah tidak bisa dipakai
 * membuka penjualan di luar jadwal. Backend juga tetap menolak
 * `POST /transactions` di luar sesi, jadi penjaga ini murni soal
 * pengalaman pengguna, bukan satu-satunya lapisan keamanan.
 */

import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useActiveSession } from "../contexts/ActiveSessionContext";
import { useLanguage } from "../contexts/LanguageContext";

const RequireActiveSession: React.FC = () => {
  const { hasActive, isLoading } = useActiveSession();
  const { language, translations } = useLanguage();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-medium text-sm">{translations.checkingSession[language]}</p>
      </div>
    );
  }

  if (!hasActive) {
    return <Navigate to="/tickets-unavailable" replace />;
  }

  return <Outlet />;
};

export default RequireActiveSession;
