import React from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Komponen LanguageSelector
 * -----------------------------------------------
 * Komponen ini digunakan untuk menampilkan pilihan bahasa kepada pengguna
 * serta tombol untuk melanjutkan ke halaman pemilihan tiket. Komponen ini menggunakan
 * context untuk mengelola state bahasa yang sedang dipilih dan juga
 * menerapkan terjemahan dinamis berdasarkan bahasa yang dipilih.
 *
 * Fitur utama:
 * - Menampilkan judul dan deskripsi sambutan sesuai bahasa.
 * - Menyediakan tiga tombol untuk memilih bahasa: Indonesia, Inggris, dan Mandarin.
 * - Menyorot tombol bahasa yang sedang aktif.
 * - Tombol "Lanjutkan" untuk berpindah ke halaman pemilihan tiket.
 */
const LanguageSelector: React.FC = () => {
  // Mengambil state bahasa, fungsi untuk mengubah bahasa, dan objek terjemahan dari context
  const { language, setLanguage, translations } = useLanguage();

  // Hook untuk melakukan navigasi antar halaman menggunakan react-router-dom
  const navigate = useNavigate();

  /**
   * Fungsi handleContinue
   * ---------------------
   * Fungsi ini akan dijalankan ketika tombol "Lanjutkan" diklik.
   * Akan mengarahkan pengguna ke halaman '/ticket-selection'.
   */
  const handleContinue = () => {
    navigate("/ticket-selection"); // <-- UPDATED PATH
  };

  return (
    // Container utama dengan styling Tailwind CSS
    <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
      {/* Bagian judul dan deskripsi sambutan */}
      <div className="text-center mb-8">
        {/* Judul sambutan, diambil dari objek translations sesuai bahasa */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {translations.welcomeTitle[language]}
        </h2>
        {/* Deskripsi sambutan */}
        <p className="text-gray-600">
          {translations.welcomeDescription[language]}
        </p>
      </div>
      {/* Grid tombol pilihan bahasa */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {/* Tombol Bahasa Indonesia */}
        <button
          onClick={() => setLanguage("id")}
          className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
            language === "id"
              ? "border-blue-600 bg-blue-50" // Jika aktif, border dan background biru
              : "border-gray-200 hover:border-blue-300" // Jika tidak aktif, border abu dan efek hover biru
          }`}
        >
          {/* Ikon lingkaran dengan inisial bahasa */}
          <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-full mb-2">
            <span className="text-xl font-bold text-red-600">ID</span>
          </div>
          {/* Label bahasa */}
          <span className="font-medium text-gray-800">Indonesia</span>
        </button>
        {/* Tombol Bahasa Inggris */}
        <button
          onClick={() => setLanguage("en")}
          className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
            language === "en"
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 hover:border-blue-300"
          }`}
        >
          <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-full mb-2">
            <span className="text-xl font-bold text-blue-600">EN</span>
          </div>
          <span className="font-medium text-gray-800">English</span>
        </button>
        {/* Tombol Bahasa Mandarin */}
        <button
          onClick={() => setLanguage("zh")}
          className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
            language === "zh"
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 hover:border-blue-300"
          }`}
        >
          <div className="w-12 h-12 flex items-center justify-center bg-yellow-100 rounded-full mb-2">
            <span className="text-xl font-bold text-yellow-600">中</span>
          </div>
          <span className="font-medium text-gray-800">中文</span>
        </button>
      </div>
      {/* Tombol untuk melanjutkan ke halaman pemilihan tiket */}
      <button
        onClick={handleContinue}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors"
      >
        {translations.continueButton[language]}
      </button>
    </div>
  );
};

export default LanguageSelector;