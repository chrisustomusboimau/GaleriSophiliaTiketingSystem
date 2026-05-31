/**
 * AdminPage.tsx
 * ----------------------------------------------------
 * Halaman utama (wrapper) untuk Admin Dashboard.
 * Diperbarui dengan identitas visual Galeria Sophilia pada Header,
 * serta background putih bersih untuk area data kasir.
 * UPDATE: Tombol "Daftar Akun" hanya muncul untuk role Admin.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import ManualEntryModal from '../components/ManualEntryModal';
import Header from '../components/Header'; // <Header />

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Mengambil profil user yang sedang login untuk mengecek role-nya
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const tokenType = localStorage.getItem('token_type') ?? 'Bearer';
        
        if (!token) return;

        const response = await fetch('/api/v1/users/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `${tokenType} ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUserRole(data.role); // Set state role (admin, kasir, atau checker)
        }
      } catch (error) {
        console.error("Gagal mengambil profil user:", error);
      }
    };

    fetchUserProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    navigate('/login', { replace: true });
  };

  const handleManualSuccess = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
      
      {/* HEADER: Identitas Visual Galeria Sophilia */}
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          
          {/* Logo Digital Galeria Sophilia */}
          <Header />

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Badge Admin Panel (Tema Gelap) */}
            <div className="hidden md:flex items-center gap-2 text-xs font-bold tracking-widest uppercase bg-[#1a1a1a] text-[#fb9418] border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
              Admin Panel
              {userRole && (
                <span className="bg-[#fb9418] text-black px-1.5 py-0.5 rounded text-[9px] font-black">
                  {userRole}
                </span>
              )}
            </div>

            {/* TOMBOL DAFTAR AKUN (HANYA RENDER JIKA ROLE == ADMIN) */}
            {userRole === 'admin' && (
              <button
                onClick={() => navigate('/admin/users')}
                className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
              >
                <span className="hidden sm:inline">Daftar Akun</span>
                <span className="sm:hidden">Akun</span>
              </button>
            )}

            {/* Tombol Riwayat Transaksi */}
            <button
              onClick={() => navigate('/admin/history')}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
            >
              <span className="hidden sm:inline">Riwayat Transaksi</span>
              <span className="sm:hidden">Riwayat</span>
            </button>

            {/* Tombol Logout */}
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-500 hover:bg-red-600 hover:text-[#fcfcfc] transition-all active:scale-95"
            >
              Logout
            </button>
          </div>

        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto text-black">
          <AdminDashboard />
        </div>
      </main>

      {/* Render komponen modal */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={handleManualSuccess}
      />
    </div>
  );
};

export default AdminPage;