/**
 * src/pages/UserManagementPage.tsx
 * ----------------------------------------------------
 * Halaman untuk melihat daftar akun staf yang terdaftar.
 * Bertugas mengambil data (fetching), menambah data, 
 * dan memanggil UserManagementComponent.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UserManagementComponent, { UserData } from "../components/UserManagementComponent";
import AddUserModal from "../components/AddUserModal";

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State untuk modal tambah akun
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState<boolean>(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    const tokenType = localStorage.getItem("token_type") ?? "Bearer";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
    };
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    navigate("/login", { replace: true });
  };

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/v1/users", {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          return;
        }
        if (response.status === 403) {
          throw new Error("Akses Ditolak. Halaman ini khusus untuk Admin Utama.");
        }
        throw new Error("Gagal mengambil data akun dari server.");
      }

      const data: UserData[] = await response.json();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan saat memuat data.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Fungsi untuk Handle Form Submit dari Modal
  const handleAddUser = async (userData: any) => {
    setIsSubmittingAdd(true);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          role: userData.role,
          is_active: true,
          is_superuser: false,
          is_verified: false,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        // Cek jika error spesifik email sudah terdaftar
        if (errData.detail === "REGISTER_USER_ALREADY_EXISTS") {
          throw new Error("Email ini sudah digunakan oleh akun lain.");
        }
        throw new Error(errData.detail || "Gagal mendaftarkan akun.");
      }

      // Tutup modal dan refresh data tabel
      setIsAddModalOpen(false);
      await loadUsers();
      
      // Opsional: Anda bisa tambahkan toast success di sini
    } catch (err: any) {
      throw err; // Lempar error kembali ke modal agar ditampilkan di UI Modal
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans text-black">
      
      {/* HEADER TEMA GALERIA SOPHILIA */}
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <div className="flex flex-col select-none cursor-pointer" onClick={() => navigate("/admin")}>
            <h2 className="text-[#fcfcfc] font-light tracking-[0.3em] text-[10px] sm:text-xs uppercase ml-0.5">
              Galeria
            </h2>
            <h1 className="text-[#fb9418] font-bold tracking-wider text-xl sm:text-2xl uppercase leading-none mt-0.5">
              Sophilia
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin")}
              className="text-xs sm:text-sm font-bold px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Kembali
            </button>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          <header className="border-b-2 border-gray-200 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-black uppercase tracking-wider">
                Manajemen Akun Staf
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Daftar seluruh akun Admin, Kasir, dan Checker yang terdaftar di sistem.
              </p>
            </div>
            
            {/* Tombol Tambah Akun (Disembunyikan jika terjadi error 403 / akses ditolak) */}
            {!error && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="text-sm font-bold px-5 py-2.5 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 transition-all shadow-sm focus:ring-2 focus:ring-[#fb9418] flex items-center gap-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
                </svg>
                Tambah Akun
              </button>
            )}
          </header>

          {/* Pemanggilan Komponen Tabel */}
          <UserManagementComponent 
            users={users} 
            isLoading={isLoading} 
            error={error} 
          />

        </div>
      </main>

      {/* Pemanggilan Komponen Modal */}
      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddUser}
        isSubmitting={isSubmittingAdd}
      />

    </div>
  );
};

export default UserManagementPage;