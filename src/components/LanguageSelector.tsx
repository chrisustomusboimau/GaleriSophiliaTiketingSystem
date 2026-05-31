/**
 * LanguageSelector.tsx
 * -----------------------------------------------
 * Komponen ini digunakan untuk menampilkan pilihan bahasa kepada pengguna
 * serta tombol untuk melanjutkan ke halaman pemilihan tiket.
 * Diperbarui agar sesuai dengan identitas visual Galeria Sophilia (Hitam, Oranye, Putih).
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";

const LanguageSelector: React.FC = () => {
  const { language, setLanguage, translations } = useLanguage();
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate("/info"); 
  };

  return (
    // Menggunakan w-full dan menghapus background/shadow luar agar 
    // menyatu dengan sempurna saat dipanggil di dalam Card putih pada ScanPage.tsx
    <div className="w-full flex flex-col items-center">
      
      {/* Bagian judul dan deskripsi sambutan
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-black mb-2">
          {translations.welcomeTitle[language]}
        </h2>
        <p className="text-gray-500 text-sm">
          {translations.welcomeDescription[language]}
        </p>
      </div> */}

      {/* Grid tombol pilihan bahasa */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-8">
        
        {/* Tombol Bahasa Indonesia */}
        <button
          onClick={() => setLanguage("id")}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
            language === "id"
              ? "border-[#fb9418] bg-orange-50 shadow-sm scale-[1.02]" 
              : "border-gray-200 bg-white hover:border-[#fb9418]" 
          }`}
        >
          {/* Ikon lingkaran elegan (Berubah oranye jika aktif) */}
          <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-3 transition-colors ${
            language === "id" ? "bg-[#fb9418] text-[#fcfcfc]" : "bg-gray-100 text-gray-400"
          }`}>
            <span className="text-lg font-bold">ID</span>
          </div>
          <span className={`font-bold text-sm ${language === "id" ? "text-black" : "text-gray-500"}`}>
            Indonesia
          </span>
        </button>

        {/* Tombol Bahasa Inggris */}
        <button
          onClick={() => setLanguage("en")}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
            language === "en"
              ? "border-[#fb9418] bg-orange-50 shadow-sm scale-[1.02]"
              : "border-gray-200 bg-white hover:border-[#fb9418]"
          }`}
        >
          <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-3 transition-colors ${
            language === "en" ? "bg-[#fb9418] text-[#fcfcfc]" : "bg-gray-100 text-gray-400"
          }`}>
            <span className="text-lg font-bold">EN</span>
          </div>
          <span className={`font-bold text-sm ${language === "en" ? "text-black" : "text-gray-500"}`}>
            English
          </span>
        </button>

        {/* Tombol Bahasa Mandarin */}
        {/* <button
          onClick={() => setLanguage("zh")}
          className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
            language === "zh"
              ? "border-[#fb9418] bg-orange-50 shadow-sm scale-[1.02]"
              : "border-gray-200 bg-white hover:border-[#fb9418]"
          }`}
        >
          <div className={`w-12 h-12 flex items-center justify-center rounded-full mb-3 transition-colors ${
            language === "zh" ? "bg-[#fb9418] text-[#fcfcfc]" : "bg-gray-100 text-gray-400"
          }`}>
            <span className="text-lg font-bold">中</span>
          </div>
          <span className={`font-bold text-sm ${language === "zh" ? "text-black" : "text-gray-500"}`}>
            中文
          </span>
        </button> */}

      </div>

      {/* Tombol Lanjutkan */}
      <button
        onClick={handleContinue}
        className="w-full bg-[#fb9418] text-[#fcfcfc] py-3.5 px-4 rounded-xl font-bold text-lg hover:bg-orange-500 active:scale-95 transition-all shadow-md flex justify-center items-center gap-2"
      >
        {translations.continueButton[language]}
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>
    </div>
  );
};

export default LanguageSelector;