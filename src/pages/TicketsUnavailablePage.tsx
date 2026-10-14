/**
 * TicketsUnavailablePage.tsx
 * ----------------------------------------------------
 * Halaman tujuan pengunjung ketika TIDAK ADA sesi penjualan yang sedang
 * berjalan. Dicapai lewat dua jalan:
 *
 *   1) `RequireActiveSession` mengalihkan ke sini saat pengunjung mencoba
 *      membuka `/ticket-selection` atau `/visitor-form` di luar jam sesi.
 *   2) `VisitorForm` mengalihkan ke sini kalau `POST /transactions` ditolak
 *      403 — yaitu ketika sesi keburu berakhir selagi pengunjung mengisi
 *      formulir.
 *
 * Isi modal berupa informasi jam ketersediaan formulir (ID + EN, teks tetap
 * sesuai desain) tanpa tombol navigasi apa pun. Modal berlatar putih dengan
 * teks hitam.
 */

import React from "react";
import Header from "../components/Header";

const TicketsUnavailablePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col relative font-sans">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-zinc-900 -z-10" />

        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 sm:p-10 border-4 border-[#fb9418] text-center text-black">
          {/* Judul */}
          <h2 className="text-xl sm:text-2xl font-normal">
            Formulir belum tersedia
          </h2>
          <p className="text-lg sm:text-xl italic mb-8">
            The form is not available
          </p>

          {/* Bahasa Indonesia */}
          <p className="text-base sm:text-lg mb-4">
            Formulir ini hanya dapat diakses pada waktu berikut:
          </p>
          <div className="text-center mb-8">
            <ul className="inline-block text-left list-disc pl-6 font-bold text-base sm:text-lg space-y-1">
              <li>Sabtu tertentu: 12.30 – 16.00</li>
              <li>Minggu: 11.00 – 14.35</li>
            </ul>
          </div>

          {/* English */}
          <p className="text-base sm:text-lg italic mb-4">
            This form is only available at:
          </p>
          <div className="text-center">
            <ul className="inline-block text-left list-disc pl-6 font-bold italic text-base sm:text-lg space-y-1">
              <li>Selected Saturdays: 12:30 - 16:00</li>
              <li>Sundays: 11:00 - 14:35</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TicketsUnavailablePage;