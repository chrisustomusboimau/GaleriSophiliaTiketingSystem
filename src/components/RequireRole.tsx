/**
 * src/components/RequireRole.tsx
 * ----------------------------------------------------
 * Guard TINGKAT ROUTE (bukan cuma sembunyikan tombol/tab di UI).
 * Dipasang sebagai layout route DI DALAM <ProtectedRoute/>, jadi saat
 * dipanggil, token & profil user (`useAuth().user`) sudah pasti tersedia.
 *
 * Contoh pemakaian di App.tsx:
 *   <Route element={<RequireRole allowed={["admin"]} />}>
 *     <Route path="/admin" element={<AdminPage />} />
 *   </Route>
 */

import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { UserRole } from "../types";

interface RequireRoleProps {
  allowed: UserRole[];
  /** Ke mana user yang rolenya tidak diizinkan diarahkan. Default: /sesi (landing non-admin). */
  redirectTo?: string;
}

const RequireRole: React.FC<RequireRoleProps> = ({ allowed, redirectTo = "/sesi" }) => {
  const { user, isLoading } = useAuth();

  // ProtectedRoute (parent) sudah menahan loading & kasus "tidak ada user sama
  // sekali", jadi di sini kita hanya perlu jaga-jaga ekstra.
  if (isLoading) return null;

  if (!user || !allowed.includes(user.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
};

export default RequireRole;
