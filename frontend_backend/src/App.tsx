import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider } from "./contexts/AuthContext";
import ScanPage from "./pages/ScanPage";
import TicketSelectionPage from "./pages/TicketSelectionPage";
import VisitorFormPage from "./pages/VisitorFormPage";
import QueuePage from "./pages/QueuePage";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRole from "./components/RequireRole";
import GalleryInfoPage from "./pages/GalleryInfoPage";
import UserManagementPage from "./pages/UserManagementPage";
import SessionsListPage from "./pages/SessionsListPage";
import SessionDetailPage from "./pages/SessionDetailPage";
import TicketsUnavailablePage from "./pages/TicketsUnavailablePage";
import { ActiveSessionProvider } from "./contexts/ActiveSessionContext";
import RequireActiveSession from "./components/RequireActiveSession";

/**
 * Root application component.
 *
 * Route structure:
 * /                  → Language selection screen (ScanPage)
 * /info              → Gallery info (GalleryInfoPage)
 * /ticket-selection  → Ticket category selection (TicketSelectionPage)
 * /visitor-form      → Visitor details and origin form (VisitorFormPage)
 * /queue/:id         → Queue number confirmation screen (QueuePage)
 * /tickets-unavailable → Fallback saat tidak ada sesi berjalan
 * /login             → Admin/Staff login screen (LoginPage)
 *
 * GERBANG SESI (BARU): `/ticket-selection` & `/visitor-form` dibungkus
 * `RequireActiveSession` — pengunjung hanya bisa masuk kalau ada sesi
 * penjualan yang sedang berjalan tepat saat ini; kalau tidak, mereka
 * dialihkan ke `/tickets-unavailable`.
 *
 * `/queue/:id` SENGAJA DI LUAR gerbang itu: pengunjung harus tetap bisa
 * membuka kembali nomor antriannya setelah sesi berakhir. Begitu juga `/`
 * dan `/info` yang murni informasi.
 *
 * PROTECTED (token wajib ada & profil user berhasil dimuat — lihat
 * ProtectedRoute + AuthContext):
 *
 *   Admin-only (RequireRole allowed=["admin"]):
 *   /admin             → Shell manajemen: Master Tiket / Akun Staf
 *                         (components/admin/AdminPage.tsx). Hanya admin
 *                         yang boleh melihat sesi draft/closed, membuat
 *                         sesi baru, serta membuka/menutup sesi.
 *   /admin/users       → @deprecated, redirect otomatis ke tab Staf di /admin
 *
 *   Semua staf (RequireRole allowed=["admin","kasir","checker"]):
 *   /sesi              → Daftar Sesi Operasional — LANDING PAGE non-admin.
 *                         Kasir/checker HANYA melihat sesi berstatus
 *                         'opened' (sesi draft/closed disembunyikan total
 *                         dari mereka — lihat OperationalSessionManager.tsx).
 *   /sesi/:sessionId   → Detail sesi, 3 tab: Antrian Kasir / Riwayat
 *                         Transaksi / Ringkasan (termasuk Audit Tiket),
 *                         semuanya terfilter ke sesi ini. Kasir/checker
 *                         diblokir mengakses halaman ini kalau sesinya
 *                         bukan 'opened' (guard di SessionDetailPage.tsx).
 *
 * UPDATE PENTING (perombakan navigasi & RBAC):
 * - /admin/history (Riwayat Transaksi lintas-sesi) DIHAPUS TOTAL.
 * - /admin/summary DIHAPUS TOTAL — "Ringkasan" (dulu halaman terpisah)
 *   sekarang jadi tab ketiga di /sesi/:sessionId, sekalian menggabungkan
 *   apa yang dulu jadi tab "Audit Tiket" terpisah di /admin.
 * - Non-admin (kasir/checker) TIDAK BISA mengakses /admin sama sekali,
 *   dan TIDAK BISA membuka/menutup sesi — hanya admin.
 * - AuthProvider dipasang di root (di luar <Routes>) supaya LoginPage bisa
 *   membaca role user yang sama dengan yang dipakai RequireRole, tanpa
 *   fetch /users/me berulang-ulang di banyak tempat.
 */
export function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <div className="w-full min-h-screen bg-slate-50">
            <Routes>
              {/* Public routes — bebas diakses kapan saja */}
              <Route path="/" element={<ScanPage />} />
              <Route path="/info" element={<GalleryInfoPage />} />
              <Route path="/queue/:id" element={<QueuePage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Alur pembelian — status sesi diambil SEKALI di provider,
                  lalu dipakai bersama oleh penjaga rute & halamannya.
                  Halaman fallback ikut di dalam provider supaya tombol
                  "Periksa Lagi" bisa memuat ulang status yang sama. */}
              <Route element={<ActiveSessionProvider />}>
                <Route path="/tickets-unavailable" element={<TicketsUnavailablePage />} />
                <Route element={<RequireActiveSession />}>
                  <Route path="/ticket-selection" element={<TicketSelectionPage />} />
                  <Route path="/visitor-form" element={<VisitorFormPage />} />
                </Route>
              </Route>

              {/* Protected routes — ProtectedRoute checks token + loads user profile */}
              <Route element={<ProtectedRoute />}>
                {/* Admin-only area */}
                <Route element={<RequireRole allowed={["admin"]} />}>
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/admin/users" element={<UserManagementPage />} />
                </Route>

                {/* Area untuk seluruh staf (admin, kasir, checker) */}
                <Route element={<RequireRole allowed={["admin", "kasir", "checker"]} />}>
                  <Route path="/sesi" element={<SessionsListPage />} />
                  <Route path="/sesi/:sessionId" element={<SessionDetailPage />} />
                </Route>
              </Route>

              {/* Any unknown path falls back to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}
