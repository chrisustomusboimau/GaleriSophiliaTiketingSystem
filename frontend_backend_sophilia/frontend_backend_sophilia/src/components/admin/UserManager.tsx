/**
 * UserManager.tsx (src/components/admin) — KOMPONEN BARU
 * ----------------------------------------------------
 * Administrasi akun staf: daftar, tambah (registrasi ditutup untuk
 * publik — hanya admin), edit role/status/password, dan hapus akun.
 *
 * RBAC: seluruh tab ini hanya untuk role admin (di-guard juga di level
 * AdminPage, tapi endpoint backend sendiri sudah menolak non-admin).
 */

import React, { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "../../api/client";
import { UserStaff, UserRegisterPayload, UserUpdatePayload, UserRole } from "../../types";
import { ROLE_LABEL } from "../../utils/formatters";

interface UserManagerProps {
  currentUserId: string | null;
}

const ROLE_OPTIONS: UserRole[] = ["admin", "kasir", "checker"];

const UserManager: React.FC<UserManagerProps> = ({ currentUserId }) => {
  const [users, setUsers] = useState<UserStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<UserRegisterPayload>({ email: "", password: "", role: "kasir" });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<UserStaff | null>(null);
  const [editForm, setEditForm] = useState<UserUpdatePayload>({});
  const [editPasswordEnabled, setEditPasswordEnabled] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGet<UserStaff[]>("/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengambil data akun.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAddModal = () => {
    setAddForm({ email: "", password: "", role: "kasir" });
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAddUser = async () => {
    if (!addForm.email.trim() || !addForm.password) {
      setAddError("Email dan password wajib diisi.");
      return;
    }
    if (addForm.password.length < 8) {
      setAddError("Password minimal 8 karakter.");
      return;
    }
    try {
      setAddSaving(true);
      setAddError(null);
      await apiPost("/auth/register", {
        email: addForm.email.trim(),
        password: addForm.password,
        role: addForm.role,
        is_active: true,
        is_superuser: false,
        is_verified: false,
      });
      setIsAddOpen(false);
      await loadUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.detail;
        if (detail === "REGISTER_USER_ALREADY_EXISTS") {
          setAddError("Email ini sudah digunakan oleh akun lain.");
        } else {
          setAddError(err.message);
        }
      } else {
        setAddError("Gagal mendaftarkan akun.");
      }
    } finally {
      setAddSaving(false);
    }
  };

  const openEditModal = (user: UserStaff) => {
    setEditingUser(user);
    setEditForm({ email: user.email, role: user.role, is_active: user.is_active });
    setEditPasswordEnabled(false);
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    const payload: UserUpdatePayload = {
      email: editForm.email,
      role: editForm.role,
      is_active: editForm.is_active,
    };
    if (editPasswordEnabled && editForm.password) {
      if (editForm.password.length < 8) {
        setEditError("Password minimal 8 karakter.");
        return;
      }
      payload.password = editForm.password;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      await apiPatch(`/users/${editingUser.id}/update`, payload);
      setEditingUser(null);
      await loadUsers();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = async (user: UserStaff) => {
    if (user.id === currentUserId) {
      window.alert("Anda tidak bisa menghapus akun Anda sendiri.");
      return;
    }
    if (!window.confirm(`Hapus akun "${user.email}" secara permanen?`)) return;
    try {
      await apiDelete(`/users/${user.id}/delete`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus akun.");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto text-black">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Manajemen Akun Staf</h3>
          <p className="text-gray-500 text-sm mt-1">Daftar seluruh akun Admin, Kasir, dan Checker yang terdaftar di sistem.</p>
        </div>
        <button
          onClick={openAddModal}
          className="text-sm font-bold px-4 py-2.5 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2 active:scale-95 self-start sm:self-auto"
        >
          <span className="text-lg leading-none">+</span> Tambah Akun
        </button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 font-medium">Memuat akun staf...</div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          Belum ada akun staf.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-bold text-black">
                    {u.email}
                    {u.id === currentUserId && <span className="ml-2 text-[10px] text-gray-400 font-medium">(Anda)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full border bg-orange-50 text-[#fb9418] border-orange-200 uppercase">
                      {ROLE_LABEL[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full border bg-green-100 text-green-700 border-green-300">Aktif</span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full border bg-gray-100 text-gray-500 border-gray-300">Nonaktif</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => openEditModal(u)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-[#fb9418] hover:text-[#fb9418]">
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      disabled={u.id === currentUserId}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL TAMBAH AKUN */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Tambah Akun Staf</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4">
              {addError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{addError}</div>}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                <input
                  type="password"
                  value={addForm.password}
                  onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Minimal 8 karakter"
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setIsAddOpen(false)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg">
                Batal
              </button>
              <button
                onClick={handleAddUser}
                disabled={addSaving}
                className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50"
              >
                {addSaving ? "Mendaftarkan..." : "Daftarkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT AKUN */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Edit Akun Staf</h3>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-4">
              {editError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{editError}</div>}
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm cursor-pointer"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editForm.is_active}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418]"
                />
                <span className="text-sm font-bold text-gray-700">Akun Aktif</span>
              </label>

              <div className="pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={editPasswordEnabled}
                    onChange={(e) => setEditPasswordEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418]"
                  />
                  <span className="text-sm font-bold text-gray-700">Reset Password</span>
                </label>
                {editPasswordEnabled && (
                  <input
                    type="password"
                    value={editForm.password || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Password baru (minimal 8 karakter)"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                )}
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditingUser(null)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg">
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50"
              >
                {editSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
