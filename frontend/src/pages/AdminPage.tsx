/**
 * AdminPage.tsx
 * ----------------------------------------------------
 * Halaman utama (wrapper) untuk Admin Dashboard.
 * Diperbarui dengan identitas visual Galeria Sophilia pada Header,
 * serta background putih bersih untuk area data kasir.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import ManualEntryModal from '../components/ManualEntryModal';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    navigate('/login', { replace: true });
  };

  const handleManualSuccess = () => {
    window.location.reload();
  };

  return (
    // Background utama menggunakan Putih Bersih (#fcfcfc) untuk keterbacaan data maksimal
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans">
      
      {/* HEADER: Identitas Visual Galeria Sophilia */}
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          
          {/* Logo Digital Galeria Sophilia */}
          <div className="flex flex-col select-none cursor-pointer" onClick={() => navigate('/admin')}>
            <h2 className="text-[#fcfcfc] font-light tracking-[0.3em] text-[10px] sm:text-xs uppercase ml-0.5">
              Galeria
            </h2>
            <h1 className="text-[#fb9418] font-bold tracking-wider text-xl sm:text-2xl uppercase leading-none mt-0.5">
              Sophilia
            </h1>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Badge Admin Panel (Tema Gelap) */}
            <div className="hidden md:block text-xs font-bold tracking-widest uppercase bg-[#1a1a1a] text-[#fb9418] border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
              Admin Panel
            </div>

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
        {/* Teks di dalam konten utama diset ke warna hitam agar kontras dengan background putih */}
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