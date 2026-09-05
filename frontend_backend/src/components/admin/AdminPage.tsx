/**
 * AdminPage.tsx (src/components/admin)
 * ----------------------------------------------------
 * Shell manajemen ADMIN-ONLY. Sejak perombakan navigasi:
 * - Tab "Antrian Kasir" DIHAPUS dari sini — sekarang hanya ada di dalam
 *   `/sesi/:sessionId` (lihat `src/pages/SessionDetailPage.tsx`).
 * - Tab "Sesi Operasional" DIHAPUS dari sini — diganti tombol navigasi ke
 *   halaman mandiri `/sesi` (`src/pages/SessionsListPage.tsx`), yang juga
 *   dipakai non-admin sebagai landing page mereka.
 * - Tab "Audit Tiket" DIHAPUS dari sini — datanya sekarang melebur
 *   langsung ke dalam tab "Ringkasan" di `/sesi/:sessionId` (lihat
 *   `src/components/Summary.tsx`), sesuai permintaan supaya audit tidak
 *   terpisah dari ringkasan sesi. `AuditReportManager.tsx` sudah tidak
 *   dipakai lagi — hapus filenya dari proyek Anda.
 * - Tombol "Riwayat Transaksi" (dulu ke /admin/history) DIHAPUS —
 *   halaman itu sudah tidak ada, riwayat kini murni per-sesi.
 * - Route `/admin` sendiri sekarang di-guard `RequireRole(["admin"])` di
 *   App.tsx, jadi komponen ini tidak perlu lagi menangani kasus
 *   "non-admin nyasar ke sini" secara manual seperti versi sebelumnya.
 *
 * Sisa tab di sini: Master Tiket, Akun Staf — murni admin.
 */

import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ROLE_LABEL } from "../../utils/formatters";
import Header from "../Header";
import TicketMasterManager from "./TicketMasterManager";
import UserManager from "./UserManager";

type TabKey = "tickets" | "staff";

interface TabDef {
  key: TabKey;
  label: string;
  shortLabel: string;
}

const ALL_TABS: TabDef[] = [
  { key: "tickets", label: "Master Tiket", shortLabel: "Tiket" },
  { key: "staff", label: "Akun Staf", shortLabel: "Staf" },
];

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const requested = (location.state as { openTab?: TabKey } | null)?.openTab;
    return requested || "tickets";
  });

  // Kalau ada state.openTab yang dikirim SETELAH mount (mis. dari redirect
  // /admin/users), sinkronkan juga.
  useEffect(() => {
    const requested = (location.state as { openTab?: TabKey } | null)?.openTab;
    if (requested) setActiveTab(requested);
  }, [location.state]);

  // RequireRole di App.tsx sudah memastikan hanya admin yang sampai sini,
  // jadi `user` seharusnya selalu ada. Guard ini murni jaring pengaman.
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
      {/* HEADER */}
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <Header clickable={false} />

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-bold tracking-widest uppercase bg-[#1a1a1a] text-[#fb9418] border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
              {user.email}
              <span className="bg-[#fb9418] text-black px-1.5 py-0.5 rounded text-[9px] font-black">{ROLE_LABEL[user.role] || user.role}</span>
            </div>

            <button
              onClick={() => navigate("/sesi")}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
            >
              <span className="hidden sm:inline">Sesi Operasional</span>
              <span className="sm:hidden">Sesi</span>
            </button>

            <button
              onClick={logout}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-500 hover:bg-red-600 hover:text-[#fcfcfc] transition-all active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar">
          {ALL_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key ? "border-[#fb9418] text-[#fb9418]" : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto text-black">
          {activeTab === "tickets" && <TicketMasterManager role={user.role} />}
          {activeTab === "staff" && <UserManager currentUserId={user.id} />}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
