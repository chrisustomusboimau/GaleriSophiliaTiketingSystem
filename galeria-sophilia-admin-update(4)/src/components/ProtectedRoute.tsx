/**
 * ProtectedRoute.tsx
 * ----------------------------------------------------
 * Wraps any route that requires authentication.
 *
 * UPDATE (selaras AuthContext baru):
 * [1] Tetap cek token dulu secara sinkron (perilaku asli) — kalau tidak
 *     ada token, langsung redirect ke /login tanpa nunggu network apa pun.
 * [2] Kalau token ada, tunggu `AuthContext` (dipasang di root App.tsx)
 *     selesai memuat profil user (`GET /users/me`) sebelum merender child
 *     route. Ini WAJIB supaya `RequireRole` (dipasang di dalam sini) sudah
 *     punya `user.role` yang valid saat dievaluasi, bukan `null` sesaat.
 * [3] Kalau token ternyata invalid/kedaluwarsa, `api/client.ts` sudah
 *     menangani hard-redirect ke /login secara global (lihat forceLogout).
 *     Baris `!user` di bawah ini hanya jaring pengaman tambahan.
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute() {
  const token = localStorage.getItem("access_token");

  // [1] If no token exists, redirect to login immediately — no need to
  // even touch AuthContext for this fast path.
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <AuthGate />;
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
        <p className="text-gray-400 font-medium">Memuat sesi Anda...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Token exists & profil user berhasil dimuat — render child route.
  return <Outlet />;
}
