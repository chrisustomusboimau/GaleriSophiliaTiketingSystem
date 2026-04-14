import { useState, createContext, useContext, ReactNode } from "react";

/**
 * Tipe bahasa yang didukung oleh aplikasi
 * - id : Bahasa Indonesia
 * - en : English
 * - zh : Mandarin
 */
type Language = "id" | "en" | "zh";

/**
 * Struktur data untuk Language Context
 * Digunakan untuk mengelola state bahasa dan terjemahan global
 */
interface LanguageContextType {
  /** Bahasa yang sedang aktif */
  language: Language;

  /** Fungsi untuk mengubah bahasa aktif */
  setLanguage: (language: Language) => void;

  /**
   * Objek terjemahan
   * key pertama  : identifier text (contoh: welcomeTitle)
   * key kedua    : bahasa (id | en | zh)
   */
  translations: {
    [key: string]: Record<Language, string>;
  };
}

/**
 * Default terjemahan aplikasi
 * Berisi seluruh teks UI yang mendukung multi-bahasa
 */
const defaultTranslations = {
  welcomeTitle: {
    id: "Selamat Datang di Museum",
    en: "Welcome to the Museum",
    zh: "欢迎来到博物馆",
  },
  welcomeDescription: {
    id: "Silakan pilih bahasa Anda untuk melanjutkan",
    en: "Please select your language to continue",
    zh: "请选择您的语言以继续",
  },
  continueButton: {
    id: "Lanjutkan",
    en: "Continue",
    zh: "继续",
  },
  ticketingTitle: {
    id: "Pembelian Tiket Museum",
    en: "Museum Ticketing",
    zh: "博物馆售票",
  },
  visitorCount: {
    id: "Jumlah Pengunjung",
    en: "Visitor Count",
    zh: "访客数量",
  },
  visitorDescription: {
    id: "Masukkan jumlah pengunjung berdasarkan usia",
    en: "Enter the number of visitors by age",
    zh: "按年龄输入访客数量",
  },
  childLabel: {
    id: "Anak (Di bawah 8 tahun)",
    en: "Child (Under 8 years)",
    zh: "儿童（8岁以下）",
  },
  teenLabel: {
    id: "Remaja (Di bawah 22 tahun)",
    en: "Teen (Under 22 years)",
    zh: "青少年（22岁以下）",
  },
  adultLabel: {
    id: "Dewasa (22 tahun ke atas)",
    en: "Adult (22 years and above)",
    zh: "成人（22岁及以上）",
  },
  totalVisitors: {
    id: "Total Pengunjung:",
    en: "Total Visitors:",
    zh: "访客总数：",
  },
  totalPrice: {
    id: "Total Harga:",
    en: "Total Price:",
    zh: "总价：",
  },
  getQueueButton: {
    id: "Dapatkan Nomor Antrian",
    en: "Get Queue Number",
    zh: "获取队列号码",
  },
  processing: {
    id: "Memproses...",
    en: "Processing...",
    zh: "处理中...",
  },
  people: {
    id: "orang",
    en: "people",
    zh: "人",
  },
  countryOrigin: {
    id: "Negara Asal",
    en: "Country of Origin",
    zh: "原籍国家",
  },
  selectCountry: {
    id: "Pilih negara asal",
    en: "Select country of origin",
    zh: "选择原籍国家",
  },
  visitorAmountError: {
    id: "Jumlah pengunjung tidak sesuai dengan negara asal",
    en: "The number of visitors does not match their country of origin",
    zh: "访客数量与其原籍国不符",
  },
  visitorAmountRequired: {
    id: "Mohon masukkan jumlah pengunjung",
    en: "Please enter the number of visitors",
    zh: "请输入访客人数",
  },
  addCountry: {
    id: "Tambah Negara",
    en: "Add Country",
    zh: "添加国家",
  },
  queueNumberLabel: {
    id: "Nomor Antrian Anda",
    en: "Your Queue Number",
    zh: "您的排队号码",
  },
  visitorDetailTitle: {
    id: "Detail Pengunjung",
    en: "Visitor Details",
    zh: "访客详情",
  },
  totalPriceLabel: {
    id: "Total Harga",
    en: "Total Price",
    zh: "总价",
  },
  queueInstruction: {
    id: "Silakan tunjukkan QR Code atau nomor antrian ini kepada petugas kasir untuk melakukan pembayaran dan mendapatkan tiket masuk fisik Anda.",
    en: "Please show this QR code or queue number to the cashier to make the payment and receive your physical entrance ticket.",
    zh: "请向收银员出示此二维码或排队号码以完成付款并领取实体入场票。",
  },

};

/**
 * Context React untuk Language
 * Default value dibuat undefined agar bisa divalidasi
 */
const LanguageContext =
  createContext<LanguageContextType | undefined>(undefined);

/**
 * Props untuk LanguageProvider
 */
type LanguageProviderProps = {
  /** Komponen anak yang akan dibungkus oleh provider */
  children: ReactNode;
};

/**
 * LanguageProvider
 * ----------------
 * Provider global untuk:
 * - bahasa aktif
 * - fungsi pengubah bahasa
 * - data terjemahan
 */
export const LanguageProvider = ({ children }: LanguageProviderProps) => {
  /** State bahasa, default: Bahasa Indonesia */
  const [language, setLanguage] = useState<Language>("id");

  /** Value yang akan diberikan ke seluruh komponen di dalam Provider */
  const value: LanguageContextType = {
    language,
    setLanguage,
    translations: defaultTranslations,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Custom hook untuk mengakses LanguageContext
 * Wajib dipanggil di dalam LanguageProvider
 */
export const useLanguage = () => {
  const context = useContext(LanguageContext);

  // Validasi agar hook tidak digunakan di luar Provider
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }

  return context;
};
