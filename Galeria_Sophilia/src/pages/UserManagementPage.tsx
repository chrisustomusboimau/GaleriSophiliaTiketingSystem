/**
 * src/pages/UserManagementPage.tsx
 * ----------------------------------------------------
 * @deprecated Manajemen staf sekarang tersedia sebagai tab "Akun Staf"
 * di dalam `/admin` (lihat `src/components/admin/AdminPage.tsx` ->
 * `src/components/admin/UserManager.tsx`), lengkap dengan RBAC guard
 * (hanya admin yang melihat tab tersebut) dan flow reset password /
 * hapus akun yang konsisten dengan modul lain.
 *
 * File ini dipertahankan tipis (bukan dihapus) supaya rute lama
 * `/admin/users` tidak 404 begitu saja, dan langsung mengarahkan staf
 * ke tab yang benar. Jika Anda ingin merapikan, hapus route
 * `/admin/users` di App.tsx dan hapus file ini.
 */

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/admin", { replace: true, state: { openTab: "staff" } });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
      <p className="text-gray-400 font-medium">Mengarahkan ke Manajemen Akun Staf...</p>
    </div>
  );
};

export default UserManagementPage;
