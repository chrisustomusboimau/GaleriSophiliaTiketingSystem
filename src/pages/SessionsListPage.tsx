/**
 * src/pages/SessionsListPage.tsx — BARU
 * ----------------------------------------------------
 * Halaman mandiri `/sesi`. Ini adalah:
 * - LANDING PAGE untuk non-admin (kasir/checker) setelah login.
 * - Satu-satunya pintu masuk ke `/sesi/:sessionId` (Antrian Kasir +
 *   Riwayat Transaksi per-sesi), lewat tombol "Ke Detail Sesi" yang
 *   muncul di `OperationalSessionManager` setelah sesi dibuka.
 *
 * Non-admin HANYA bisa mengakses halaman ini + /sesi/:sessionId (lihat
 * `RequireRole` di App.tsx) — jadi header di sini sengaja TIDAK
 * menampilkan tautan ke area admin lain untuk mereka. Admin melihat satu
 * tautan tambahan "Manajemen Admin" untuk kembali ke `/admin`.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROLE_LABEL } from "../utils/formatters";
import Header from "../components/Header";
import OperationalSessionManager from "../components/admin/OperationalSessionManager";

const SessionsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <Header clickable={false} />

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-bold tracking-widest uppercase bg-[#1a1a1a] text-[#fb9418] border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
              {user.email}
              <span className="bg-[#fb9418] text-black px-1.5 py-0.5 rounded text-[9px] font-black">{ROLE_LABEL[user.role] || user.role}</span>
            </div>

            {/* Non-admin tidak boleh melihat/mengakses area admin lain — tautan ini
                hanya dirender untuk admin. */}
            {user.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
              >
                <span className="hidden sm:inline">Manajemen Admin</span>
                <span className="sm:hidden">Admin</span>
              </button>
            )}

            <button
              onClick={logout}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-500 hover:bg-red-600 hover:text-[#fcfcfc] transition-all active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto text-black">
          <OperationalSessionManager role={user.role} onGoToDetail={(sessionId) => navigate(`/sesi/${sessionId}`)} />
        </div>
      </main>
    </div>
  );
};

export default SessionsListPage;
