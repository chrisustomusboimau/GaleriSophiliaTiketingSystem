/**
 * UserManagementPage.tsx
 * ----------------------------------------------------
 * Halaman untuk melihat daftar akun staf yang terdaftar.
 * Hanya bisa diakses secara sukses oleh akun dengan role 'admin'.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

interface UserData {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
}

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin": return "bg-red-100 text-red-700 border-red-200";
      case "checker": return "bg-blue-100 text-blue-700 border-blue-200";
      default: return "bg-green-100 text-green-700 border-green-200";
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans text-black">
      
      {/* HEADER */}
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
          
          <header className="border-b-2 border-gray-200 pb-5">
            <h2 className="text-2xl font-bold text-black uppercase tracking-wider">
              Manajemen Akun Staf
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              Daftar seluruh akun Admin, Kasir, dan Checker yang terdaftar di sistem.
            </p>
          </header>

          {/* UI Error Akses Ditolak */}
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
              <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              <h3 className="text-lg font-black uppercase tracking-wider mb-1">Akses Ditolak</h3>
              <p className="text-sm font-medium">{error}</p>
              <button 
                onClick={() => navigate('/admin')}
                className="mt-4 px-6 py-2 bg-black text-white font-bold text-sm rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black text-[#fcfcfc] text-xs font-bold uppercase tracking-widest border-b border-zinc-800">
                      <th className="p-4">Email / Username</th>
                      <th className="p-4 text-center">Role Akses</th>
                      <th className="p-4 text-center">Status Aktif</th>
                      <th className="p-4 text-right">User ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-orange-50/30 transition-colors">
                        <td className="p-4 font-bold text-black">{user.email}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider border ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {user.is_active ? (
                            <span className="text-green-600 font-bold flex items-center justify-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> Aktif
                            </span>
                          ) : (
                            <span className="text-gray-400 font-bold flex items-center justify-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg> Nonaktif
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right font-mono text-xs text-gray-400">
                          {user.id.split('-')[0]}***
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400 italic">Tidak ada data user ditemukan.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default UserManagementPage;