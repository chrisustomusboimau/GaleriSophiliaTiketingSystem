/**
 * src/components/UserManagementComponent.tsx
 * ----------------------------------------------------
 * Komponen presentasional untuk menampilkan tabel daftar akun.
 * Update: Menambahkan tombol Edit dan integrasi UserEditModal.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserEditModal from "./UserEditModal";

// Didefinisikan & diekspor di sini agar bisa dipakai oleh Page dan Modal
export interface UserData {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
}

interface UserManagementComponentProps {
  users: UserData[];
  isLoading: boolean;
  error: string | null;
  onUsersUpdate?: (updatedUser: UserData) => void;
}

const UserManagementComponent: React.FC<UserManagementComponentProps> = ({
  users: initialUsers,
  isLoading,
  error,
  onUsersUpdate,
}) => {
  const navigate = useNavigate();

  // State lokal untuk list user — memungkinkan optimistic update setelah edit
  const [users, setUsers] = useState<UserData[]>(initialUsers);
  const [editTarget, setEditTarget] = useState<UserData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Sync jika parent mengoper props baru (misalnya setelah reload)
  React.useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const handleEditClick = (user: UserData) => {
    setEditTarget(user);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    // Beri delay kecil sebelum clear target agar animasi tutup terlihat
    setTimeout(() => setEditTarget(null), 150);
  };

  const handleSaveSuccess = (updatedUser: UserData) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    onUsersUpdate?.(updatedUser);
  };

  const handleDeleteSuccess = (deletedUserId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== deletedUserId));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":   return "bg-red-100 text-red-700 border-red-200";
      case "checker": return "bg-blue-100 text-blue-700 border-blue-200";
      default:        return "bg-green-100 text-green-700 border-green-200"; // kasir
    }
  };

  // ----- Render States -----

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
        <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-black uppercase tracking-wider mb-1">Akses Ditolak</h3>
        <p className="text-sm font-medium">{error}</p>
        <button
          onClick={() => navigate("/admin")}
          className="mt-4 px-6 py-2 bg-black text-white font-bold text-sm rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black text-[#fcfcfc] text-xs font-bold uppercase tracking-widest border-b border-zinc-800">
                <th className="p-4">Email / Username</th>
                <th className="p-4 text-center">Role Akses</th>
                <th className="p-4 text-center">Status Aktif</th>
                <th className="p-4 text-right">User ID</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-orange-50/30 transition-colors">

                  {/* Email */}
                  <td className="p-4 font-bold text-black">{user.email}</td>

                  {/* Role Badge */}
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider border ${getRoleBadgeColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>

                  {/* Status Aktif */}
                  <td className="p-4 text-center">
                    {user.is_active ? (
                      <span className="text-green-600 font-bold flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                        Aktif
                      </span>
                    ) : (
                      <span className="text-gray-400 font-bold flex items-center justify-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Nonaktif
                      </span>
                    )}
                  </td>

                  {/* User ID (disamarkan) */}
                  <td className="p-4 text-right font-mono text-xs text-gray-400">
                    {user.id.split("-")[0]}***
                  </td>

                  {/* Tombol Edit */}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleEditClick(user)}
                      title={`Edit akun ${user.email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-300 text-zinc-600 hover:border-[#fb9418] hover:text-[#fb9418] hover:bg-[#fb9418]/5 transition-all active:scale-95"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                      </svg>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                    Tidak ada data user ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Akun */}
      <UserEditModal
        user={editTarget}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSaveSuccess={handleSaveSuccess}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
};

export default UserManagementComponent;