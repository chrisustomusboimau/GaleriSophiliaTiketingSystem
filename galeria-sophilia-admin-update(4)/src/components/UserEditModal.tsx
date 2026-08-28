/**
 * src/components/UserEditModal.tsx
 * ----------------------------------------------------
 * Modal untuk mengedit data akun staf.
 * Bisa mengubah: email, role, status aktif, dan password (opsional).
 * Termasuk fitur hapus akun dengan konfirmasi inline.
 */

import React, { useState, useEffect } from "react";
import { UserData } from "./UserManagementComponent";

interface UserEditModalProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: (updatedUser: UserData) => void;
  onDeleteSuccess: (deletedUserId: string) => void;
}

const ROLES = ["admin", "kasir", "checker"];

const getAuthHeaders = () => {
  const token = localStorage.getItem("access_token");
  const tokenType = localStorage.getItem("token_type") ?? "Bearer";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
  };
};

const UserEditModal: React.FC<UserEditModalProps> = ({
  user,
  isOpen,
  onClose,
  onSaveSuccess,
  onDeleteSuccess,
}) => {
  const [email, setEmail]               = useState<string>("");
  const [role, setRole]                 = useState<string>("");
  const [isActive, setIsActive]         = useState<boolean>(true);
  const [newPassword, setNewPassword]   = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isSaving, setIsSaving]         = useState<boolean>(false);
  const [isDeleting, setIsDeleting]     = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  const [error, setError]               = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<{ email?: string; password?: string }>({});

  // Sync form state saat user berubah
  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setRole(user.role);
      setIsActive(user.is_active);
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setFieldErrors({});
      setShowPassword(false);
      setShowDeleteConfirm(false);
    }
  }, [user]);

  // Tutup modal saat tekan Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else onClose();
      }
    };
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, showDeleteConfirm]);

  if (!isOpen || !user) return null;

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = "Email tidak boleh kosong.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Format email tidak valid.";
    }

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        errors.password = "Password baru minimal 8 karakter.";
      } else if (newPassword !== confirmPassword) {
        errors.password = "Konfirmasi password tidak cocok.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    setError(null);

    // Hanya kirim field yang berubah
    const payload: Record<string, any> = {};
    if (email !== user.email) payload.email = email;
    if (role !== user.role) payload.role = role;
    if (isActive !== user.is_active) payload.is_active = isActive;
    if (newPassword) payload.password = newPassword;

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    try {
      const response = await fetch(`/api/v1/users/${user.id}/update`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.detail || `Gagal menyimpan perubahan (${response.status}).`);
      }

      const updatedUser: UserData = await response.json();
      onSaveSuccess(updatedUser);
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/users/${user.id}/delete`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.detail || `Gagal menghapus akun (${response.status}).`);
      }

      onDeleteSuccess(user.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat menghapus.");
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasChanges =
    email !== user.email ||
    role !== user.role ||
    isActive !== user.is_active ||
    newPassword.length > 0;

  const getRoleBadgeColor = (r: string) => {
    switch (r?.toLowerCase()) {
      case "admin":   return "border-red-400 bg-red-50 text-red-700";
      case "checker": return "border-blue-400 bg-blue-50 text-blue-700";
      default:        return "border-green-400 bg-green-50 text-green-700";
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !showDeleteConfirm) onClose(); }}
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="bg-black px-6 py-4 flex items-center justify-between border-b-4 border-[#fb9418]">
          <div>
            <p className="text-[#fb9418] text-[10px] font-bold tracking-[0.3em] uppercase">Edit Akun</p>
            <h2 className="text-white font-bold text-lg leading-tight truncate max-w-xs mt-0.5">
              {user.email}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Tutup modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-5 overflow-y-auto">

          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Konfirmasi Hapus (inline) */}
          {showDeleteConfirm && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm font-black text-red-700 uppercase tracking-wide">Hapus Akun Permanen</p>
                  <p className="text-xs text-red-600 mt-1">
                    Akun <span className="font-bold">{user.email}</span> akan dihapus secara permanen dan tidak bisa dikembalikan.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-70"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Ya, Hapus Akun
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* User ID */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">User ID</label>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-xs text-gray-400 select-all">
              {user.id}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Email / Username
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })); }}
              placeholder="contoh@email.com"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
                fieldErrors.email
                  ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300"
                  : "border-gray-200 bg-gray-50 focus:border-[#fb9418] focus:ring-2 focus:ring-[#fb9418]/30"
              }`}
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Role Akses</label>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-4 py-2 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all ${
                    role === r
                      ? getRoleBadgeColor(r) + " ring-2 ring-offset-1 " +
                        (r === "admin" ? "ring-red-400" : r === "checker" ? "ring-blue-400" : "ring-green-400")
                      : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Status Aktif */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">Status Akun</label>
            <div className="flex gap-2">
              {([true, false] as const).map((val) => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setIsActive(val)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    isActive === val
                      ? val
                        ? "border-green-400 bg-green-50 text-green-700 ring-2 ring-offset-1 ring-green-400"
                        : "border-gray-400 bg-gray-100 text-gray-600 ring-2 ring-offset-1 ring-gray-400"
                      : "border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {val ? (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>Aktif</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>Nonaktif</>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Ganti Password */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
              Ganti Password{" "}
              <span className="text-gray-400 font-normal normal-case tracking-normal ml-1">
                (kosongkan jika tidak ingin diubah)
              </span>
            </label>
            <div className="space-y-2.5">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password baru..."
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm pr-10 outline-none transition-all ${
                    fieldErrors.password
                      ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300"
                      : "border-gray-200 bg-gray-50 focus:border-[#fb9418] focus:ring-2 focus:ring-[#fb9418]/30"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {newPassword && (
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Konfirmasi password baru..."
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none transition-all ${
                    fieldErrors.password
                      ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300"
                      : "border-gray-200 bg-gray-50 focus:border-[#fb9418] focus:ring-2 focus:ring-[#fb9418]/30"
                  }`}
                />
              )}
              {fieldErrors.password && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                  </svg>
                  {fieldErrors.password}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          {/* Tombol Hapus (kiri) */}
          <button
            type="button"
            onClick={() => { setShowDeleteConfirm(true); setError(null); }}
            disabled={isSaving || isDeleting || showDeleteConfirm}
            className="px-4 py-2.5 text-xs font-bold rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Hapus Akun
          </button>

          {/* Tombol Batal + Simpan (kanan) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="px-5 py-2.5 text-sm font-bold rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-black transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isDeleting || !hasChanges}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${
                hasChanges && !isSaving && !isDeleting
                  ? "bg-[#fb9418] text-black hover:bg-[#e0841a] active:scale-95 shadow-md shadow-orange-200"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />Menyimpan...</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>Simpan</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UserEditModal;