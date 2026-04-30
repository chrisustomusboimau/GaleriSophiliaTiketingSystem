/**
 * src/components/AddUserModal.tsx
 * ----------------------------------------------------
 * Modal form untuk menambahkan akun staf baru.
 */

import React, { useState } from "react";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (userData: any) => Promise<void>;
  isSubmitting: boolean;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onAdd, isSubmitting }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("kasir"); // Default kasir
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg("Email dan Password wajib diisi.");
      return;
    }
    
    if (password.length < 8) {
      setErrorMsg("Password minimal 8 karakter.");
      return;
    }

    try {
      await onAdd({ email, password, role });
      // Bersihkan form jika sukses
      setEmail("");
      setPassword("");
      setRole("kasir");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menambahkan akun.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header Modal */}
        <header className="bg-black p-5 border-b-[4px] border-[#fb9418] flex justify-between items-center">
          <h3 className="text-[#fcfcfc] font-black uppercase tracking-wider text-lg">
            Tambah Akun Staf
          </h3>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white transition-colors focus:outline-none disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm font-bold rounded-lg">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Email / Username
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              placeholder="nama@sophilia.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] transition-all font-medium text-black"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Password Sementara
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              placeholder="Minimal 8 karakter"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] transition-all font-medium text-black"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Role Akses
            </label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isSubmitting}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] transition-all font-bold text-black cursor-pointer bg-white"
            >
              <option value="kasir">KASIR (Bisa konfirmasi & edit pembayaran)</option>
              <option value="checker">CHECKER (Hanya bisa melihat riwayat)</option>
              <option value="admin">ADMIN (Akses penuh ke semua fitur)</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-2.5 rounded-xl font-bold text-sm bg-black text-[#fb9418] hover:bg-zinc-800 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#fb9418] border-t-transparent rounded-full animate-spin"></div>
                  Menyimpan...
                </>
              ) : (
                "Simpan Akun Baru"
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default AddUserModal;