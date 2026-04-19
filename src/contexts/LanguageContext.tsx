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
    id: "Selamat Datang di Galeria Sophilia", // Galeri -> Galeria
    en: "Welcome to Galeria Sophilia", // Welcome to Galeria Sophilia
    zh: "欢迎来到索菲莉亚美术馆", // 画廊 -> 美术馆 (Untuk '索菲莉亚' perlu samaain dengan punya GS, takut beda)
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
    zh: "美术馆售票", // 博物馆 -> 美术馆
  },
  visitorCount: {
    id: "Jumlah Pengunjung",
    en: "Number of Visitors", // Number of Visitors
    zh: "访客数量",
  },
  visitorDescription: {
    id: "Masukkan jumlah pengunjung berdasarkan usia",
    en: "Please select the number of visitors by age category", // Please select the number of visitors by age category
    zh: "请按年龄段选择访客人数", // 请按年龄段选择访客人数
  },
  childLabel: {
    id: "Anak \n(< 8 tahun)",
    en: "Child \n(< 8 years)", // (Under 8)
    zh: "儿童\n（8岁以下）",
  },
  teenLabel: {
    id: "Remaja \n(< 22 tahun)",
    en: "Teen \n(< 22 years)",
    zh: "青少年\n（22岁以下）",
  },
  adultLabel: {
    id: "Dewasa \n(≥ 22 tahun)",
    en: "Adult \n(≥ 22 years and above)", // tambah 22
    zh: "成人\n（22岁及以上）",
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
    zh: "位", // 位
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
    en: "The number of visitors does not match the country of origin", // their -> the
    zh: "访客数量与其原籍国不符",
  },
  visitorAmountRequired: {
    id: "Mohon masukkan jumlah pengunjung",
    en: "Please enter the number of visitors",
    zh: "请输入访客人数",
  },
  addCountry: {
    id: "Tambah Negara",
    en: "Add Nationality", // Country -> Nationality
    zh: "添加国家",
  },
  queueNumberLabel: {
    id: "Nomor Antrian Anda",
    en: "Your Queue Number",
    zh: "您的排队号码",
  },
  visitorDetailTitle: {
    id: "Detail Pengunjung",
    en: "Visitor Information", // Details -> Information
    zh: "访客详情",
  },
  totalPriceLabel: {
    id: "Total Harga",
    en: "Total Price", 
    zh: "总价", 
  },
  queueInstruction: {
    id: "Silakan tunjukkan nomor antrian ini kepada petugas kasir untuk melakukan pembayaran dan mendapatkan tiket masuk fisik Anda.",
    en: "Please present this ticket number to the cashier for payment and to collect your physical entrance ticket.", 
    zh: "请向收银员出示此二维码或排队号码以完成付款并领取实体入场票。",
  },
  floorSelectionDesc: { 
    id: "Anda memilih {count} lantai. Harga yang tertera adalah total biaya per orang untuk akses tersebut.", 
    en: "You selected {count} floors. The price shown is the total cost per person for the access.", 
    zh: "您选择了 {count} 层。显示的价格是该访问权限的人均总费用。" 
  },
  paymentMethod: { id: "Metode Pembayaran", en: "Payment Method", zh: "支付方式" },
  creditDebitCard: { id: "Kartu Kredit/Debit", en: "Credit/Debit Card", zh: "信用卡/借记卡" },
  searchCountryPlaceholder: { id: "Ketik untuk mencari negara...", en: "Type to search country...", zh: "输入以搜索国家..." },
  countryNotFound: { id: "Negara tidak ditemukan", en: "Country not found", zh: "未找到国家" },

  galleryOpenTime: { 
    id: "Galeria Sophilia dibuka selama 3 jam.", 
    en: "Galeria Sophilia is open for 3 hours.", 
    zh: "索菲亚美术馆开放 3 小时。" 
  },
  culturalExperience: { 
    id: "Temukan pengalaman budaya inspiratif:", 
    en: "Discover inspiring cultural experience:", 
    zh: "探索鼓舞人心的文化体验：" 
  },
  seeBannerInfo: { 
    id: "Silakan lihat informasi detail pada banner kami.", 
    en: "Please refer to our information banner for detailed information.", 
    zh: "请参阅我们的横幅以获取详细信息。" 
  },
  floor1: { id: "Lantai 1", en: "1ˢᵗ floor", zh: "1层" },
  floor1Desc: { 
    id: "Karya Seni Patung Barat", 
    en: "Western Sculpture Art", 
    zh: "西方雕塑艺术" 
  },
  floor5: { id: "Lantai 5", en: "5ᵗʰ flooe", zh: "5层" },
  floor5DescPart1: { 
    id: "Keramik Tiga Warna Dinasti Tang,", 
    en: "Tang Tri-Color Ceramics,", 
    zh: "唐三彩，" 
  },
  floor5DescPart2: { 
    id: "Peninggalan Budaya Jalur Sutra", 
    en: "the Silk Road Cultural Relics", 
    zh: "丝绸之路文化遗产" 
  },
  floor67: { id: "Lantai 6–7", en: "6–7ᵗʰ floor", zh: "6–7层" },
  floor67Desc: { 
    id: "Karya Seni Rupa Barat dan Barang Bersejarah Asia Timur", 
    en: "Western Fine Arts and East Asian Historical Artifacts", 
    zh: "西方美术与东亚历史文物" 
  },
  pleaseSelectTicket: { 
    id: "Silakan pilih tiket Anda", 
    en: "Please select your ticket", 
    zh: "请选择您的门票" 
  },
  forOneTwoOrAll: { 
    id: "untuk satu, dua, atau semua sekaligus", 
    en: "for one, two, or all at once", 
    zh: "选择一层、两层或全部" 
  },
  enjoyCulturalJourney: { 
    id: "dan rasakan perjalanan budaya yang berharga.", 
    en: "and experience a valuable cultural journey.", 
    zh: "并体验一次宝贵的文化之旅。" 
  },
  continueButton2: { 
    id: "Lanjutkan", 
    en: "Continue", 
    zh: "继续" 
  },

// --- TAMBAHAN BARU UNTUK TICKET SELECTION PAGE ---
  floor6And7Label: { id: "Lantai 6 & 7", en: "Floor 6 & 7", zh: "6 & 7层" },
  floor5Label: { id: "Lantai 5", en: "Floor 5", zh: "5层" },
  floor1Label: { id: "Lantai 1", en: "Floor 1", zh: "1层" },
  exhibitionArea: { id: "Area Pameran", en: "Exhibition Area", zh: "展览区域" },
  floorInfoAria: { id: "Informasi Lantai", en: "Floor Information", zh: "楼层信息" },
  floorInfoTitle: { id: "Lihat informasi kurasi lantai", en: "View floor curation information", zh: "查看楼层策展信息" },
  selectFloorInstruction: { 
    id: "Silakan pilih satu atau lebih lantai yang ingin Anda kunjungi", 
    en: "Please select one or more floors you wish to visit", 
    zh: "请选择您想参观的一个或多个楼层" 
  },
  continueSelected: { 
    id: "Lanjutkan ({count} Dipilih)", 
    en: "Continue ({count} Selected)", 
    zh: "继续 (已选 {count} 项)" 
  },
// --- TAMBAHAN BARU UNTUK QUEUE DISPLAY PAGE ---
  ticketDetails: { id: "Rincian Tiket", en: "Ticket Details", zh: "门票详情" },
  totalPerPerson: { id: "Total per orang:", en: "Total per person:", zh: "人均总计：" },
  noTicketData: { id: "Data tiket tidak tersedia.", en: "Ticket data is not available.", zh: "暂无门票数据。" },
  totalPayment: { id: "Total Pembayaran:", en: "Total Payment:", zh: "总付款：" },
  yourPaymentMethod: { id: "Pilihan Pembayaran Anda", en: "Your Payment Method", zh: "您的付款方式" },
  qrisInstruction: { 
    id: "Tunjukkan nomor antrian ke kasir dan pindai QR Code yang tersedia di meja resepsionis menggunakan aplikasi M-Banking atau E-Wallet Anda.", 
    en: "Show your queue number to the cashier and scan the QR Code available at the reception desk using your Mobile Banking or E-Wallet app.", 
    zh: "请向收银员出示排队号，并使用您的手机银行或电子钱包扫描接待台上的二维码。" 
  },
  cardInstruction: { 
    id: "Tunjukkan nomor antrian ke kasir dan persiapkan kartu Debit/Kredit fisik Anda untuk proses pembayaran menggunakan mesin EDC kami.", 
    en: "Show your queue number to the cashier and prepare your physical Debit/Credit card for payment using our EDC machine.", 
    zh: "请向收银员出示排队号，并准备好您的实体借记卡/信用卡，以便使用我们的 EDC 机器进行付款。" 
  },
// --- TAMBAHAN BARU UNTUK QUEUE PAGE ---
  visitorNotFoundDetail: { 
    id: "Data pengunjung tidak ditemukan. Tiket mungkin sudah kedaluwarsa atau ID salah.", 
    en: "Visitor data not found. The ticket may have expired or the ID is incorrect.", 
    zh: "未找到访客数据。门票可能已过期或 ID 错误。" 
  },
  fetchDataError: { 
    id: "Gagal memuat data dari server. Periksa koneksi internet Anda.", 
    en: "Failed to load data from the server. Please check your internet connection.", 
    zh: "无法从服务器加载数据。请检查您的互联网连接。" 
  },
  loadVisitorError: { 
    id: "Gagal memuat data pengunjung.", 
    en: "Failed to load visitor data.", 
    zh: "加载访客数据失败。" 
  },
  loadingQueueTicket: { 
    id: "Memuat tiket antrian...", 
    en: "Loading queue ticket...", 
    zh: "正在加载排队门票..." 
  },
  visitorNotFoundTitle: { 
    id: "Data pengunjung tidak ditemukan", 
    en: "Visitor data not found", 
    zh: "未找到访客数据" 
  },
  queueNumberInvalid: { 
    id: "Nomor antrian yang Anda cari mungkin salah, sudah dihapus, atau sesi telah berakhir.", 
    en: "The queue number you are looking for may be incorrect, deleted, or the session has expired.", 
    zh: "您查找的排队号可能不正确、已被删除或会话已过期。" 
  },
  backToHomeButton: { 
    id: "Kembali ke Halaman Utama", 
    en: "Back to Home Page", 
    zh: "返回首页" 
  },
  backToHomeAria: { 
    id: "Kembali ke Beranda", 
    en: "Back to Home", 
    zh: "返回首页" 
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
