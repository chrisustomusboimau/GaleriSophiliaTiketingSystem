import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/AdminDashboard';
import ManualEntryModal from '../components/ManualEntryModal'; // DITAMBAHKAN: Import Modal

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  
  // DITAMBAHKAN: State untuk mengontrol buka/tutup modal
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    navigate('/login', { replace: true });
  };

  // DITAMBAHKAN: Fungsi ketika pembuatan tiket manual berhasil
  const handleManualSuccess = () => {
    // Karena state pengunjung ada di dalam child component (AdminDashboard),
    // cara paling sederhana untuk me-refresh data dari parent adalah me-reload halaman,
    // atau biarkan fitur auto-refresh 30 detik di AdminDashboard yang memuatnya.
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Museum Ticketing</h1>

          <div className="flex items-center gap-3">
            {/* Badge Admin Panel (disembunyikan di layar sangat kecil agar rapi) */}
            <div className="hidden sm:block text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              Admin Dashboard
            </div>

            {/* DITAMBAHKAN: Tombol navigasi ke Halaman Riwayat */}
            <button
              onClick={() => navigate('/admin/history')}
              className="text-sm font-medium px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Riwayat Transaksi
            </button>

            <button
              onClick={handleLogout}
              className="text-sm font-medium px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>

        </div>
      </header>
      <main className="flex-1 p-4">
        <div className="max-w-7xl mx-auto">
          <AdminDashboard />
        </div>
      </main>

      {/* DITAMBAHKAN: Render komponen modal di luar struktur utama UI */}
      <ManualEntryModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={handleManualSuccess}
      />
    </div>
  );
};

export default AdminPage;