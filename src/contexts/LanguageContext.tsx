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
    id: "Silakan pilih bahasa Anda",
    en: "Please select your language",
    zh: "请选择您的语言以继续",
  },
  continueButton: {
    id: "Lanjutkan",
    en: "Continue",
    zh: "继续",
  },
  backButton: {
    id: "Kembali",
    en: "Back",
    zh: "返回",
  },
  ticketingTitle: {
    id: "Pemesanan Tiket",
    en: "Ticket Booking",
    zh: "门票预订",
  },
  visitorCount: {
    id: "Jumlah Pengunjung",
    en: "Number of Visitors", // Number of Visitors
    zh: "访客数量",
  },
  visitorDescription: {
    id: "Jumlah pengunjung berdasarkan usia",
    en: "Visitors by age category", // Please select the number of visitors by age category
    zh: "请按年龄段选择访客人数", // 请按年龄段选择访客人数
  },
  totalVisitors: {
    id: "Pengunjung",
    en: "Visitors",
    zh: "访客", 
  },
  totalPrice: {
    id: "Harga",
    en: "Price",
    zh: "价格",
  },
  getQueueButton: {
    id: "Pesan Sekarang",
    en: "Book Now",
    zh: "立即下单", 
  },
  processing: {
    id: "Mengirim...",
    en: "Submitting...",
    zh: "处理中...",
  },
  people: {
    id: "orang",
    en: "people",
    zh: "位", // 位
  },
  citizenship: {
    id: "Negara Asal",
    en: "Country",
    zh: "国籍",
  },
  selectCitizenship: {
    id: "Pilih negara asal",
    en: "Select country",
    zh: "选择国籍",
  },
  visitorAmountError: {
    id: "Jumlah pengunjung tidak sesuai",
    en: "The number of visitors does not match",
    zh: "访客数量与其原籍国不符",
  },
  visitorAmountRequired: {
    id: "Mohon masukkan jumlah pengunjung",
    en: "Please enter the number of visitors",
    zh: "请输入访客人数",
  },
  addCountry: {
    id: "Tambah",
    en: "Add",
    zh: "添加国家",
  },
  queueNumberLabel: {
    id: "Nomor Antrian Anda",
    en: "Your Queue Number",
    zh: "您的排队号码",
  },
  totalPriceLabel: {
    id: "Total Harga",
    en: "Total Price", 
    zh: "总价", 
  },
  queueInstruction: {
    id: "Mohon tunggu dipanggil sesuai nomor antrian. Setelah mendapatkan tiket, silakan titipkan tas, botol minum, dan kamera di bagian loker.",
    en: "Please wait for your queue number to be called. Once you have your ticket, kindly store your bags, drink bottles, and cameras in the locker area.",
    zh: "请耐心等待叫号。领取门票后，请将背包、水瓶和相机寄存在储物柜区域。",
  },
  paymentMethod: { id: "Metode Pembayaran", en: "Payment Method", zh: "支付方式" },
  creditDebitCard: { id: "Kartu Kredit/Debit", en: "Credit/Debit Card", zh: "信用卡/借记卡" },
  searchCountryPlaceholder: { id: "Ketik untuk mencari negara...", en: "Type to search country...", zh: "输入以搜索国家..." },
  countryNotFound: { id: "Negara tidak ditemukan", en: "Country not found", zh: "未找到国家" },

  galleryOpenTime: { 
    id: "<b>Galeria Sophilia</b> dibuka selama <b>3 jam</b>.", 
    en: "<b>Galeria Sophilia</b> is open for <b>3 hours</b>.", 
    zh: "<b>索菲亚美术馆</b>开放 <b>3 小时</b>。" 
  },
  culturalExperience: { 
    id: "Temukan pengalaman budaya inspiratif:", 
    en: "Discover inspiring cultural experience:", 
    zh: "探索鼓舞人心的文化体验：" 
  },
  seeBannerInfo: { 
    id: "Silakan lihat informasi detail pada banner kami.", 
    en: "Please refer to our information banner for details.", 
    zh: "请参阅我们的横幅以获取详细信息。" 
  },
  floor1: { id: "Lantai 1", en: "1ˢᵗ floor", zh: "1层" },
  floor1Desc: { 
    id: "Karya Seni Patung Barat", 
    en: "Western Sculpture Art", 
    zh: "西方雕塑艺术" 
  },
  floor5: { id: "Lantai 5", en: "5ᵗʰ floor", zh: "5层" },
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
    id: "boleh satu, dua, atau semua sekaligus", 
    en: "you may choose one, two, or all", 
    zh: "选择一层、两层或全部" 
  },
  enjoyCulturalJourney: { 
    id: "dan rasakan perjalanan budaya yang berharga.", 
    en: "and embark on a valuable cultural journey.", 
    zh: "并体验一次宝贵的文化之旅。" 
  },
  continueButton2: { 
    id: "Klik disini untuk memilih tiket", 
    en: "Click here to choose your tickets", 
    zh: "点击此处选择门票" 
  },

  // --- TAMBAHAN BARU UNTUK TICKET SELECTION PAGE ---
  exhibitionArea: { id: "Area Pameran", en: "Exhibition Area", zh: "展览区域" },
  continueSelected: { 
    id: "Lanjutkan ({count} Dipilih)", 
    en: "Continue ({count} Selected)", 
    zh: "继续 (已选 {count} 项)" 
  },

  // --- TAMBAHAN BARU UNTUK QUEUE DISPLAY PAGE ---
  totalPayment: { id: "Total Pembayaran:", en: "Total Payment:", zh: "总付款：" },

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

  // --- BARU: TicketSelectionPage dinamis (sesuai sesi operasional aktif) ---
  loadingTickets: {
    id: "Memuat tiket yang tersedia...",
    en: "Loading available tickets...",
    zh: "正在加载可购票种...",
  },
  noActiveSessionMessage: {
    id: "Tidak ada sesi penjualan tiket yang sedang dibuka saat ini. Silakan coba lagi nanti.",
    en: "There is no open ticket session right now. Please try again later.",
    zh: "目前没有开放的售票场次，请稍后再试。",
  },
  noTicketsAvailable: {
    id: "Belum ada tiket yang tersedia untuk dipilih saat ini.",
    en: "No tickets are available to select right now.",
    zh: "目前没有可供选择的门票。",
  },
  retryButton: {
    id: "Coba Lagi",
    en: "Try Again",
    zh: "重试",
  },
  perPersonLabel: {
    id: "per orang",
    en: "per person",
    zh: "每人",
  },

  // --- BARU: nama pemesan & metode tunai di QueueDisplay ---
  orderedByLabel: {
    id: "Dipesan atas nama",
    en: "Ordered by",
    zh: "订购人",
  },
  cashPaymentLabel: {
    id: "Tunai",
    en: "Cash",
    zh: "现金",
  },

  // --- BARU: halaman "belum bisa membeli tiket" (tidak ada sesi berjalan) ---
  // Teks ID & EN di bawah adalah salinan PERSIS dari spesifikasi — jangan
  // diubah tanpa persetujuan. Versi ZH ditambahkan agar konsisten dengan
  // seluruh kunci lain di file ini (spesifikasi hanya memberi ID & EN);
  // MOHON DIPERIKSA penutur asli sebelum dipakai di produksi.
  ticketsUnavailableTitle: {
    id: "Pembelian Tiket Belum Tersedia",
    en: "Ticket Purchase Unavailable",
    zh: "暂时无法购票",
  },
  ticketsUnavailableMessage: {
    id: "Mohon maaf saat ini Anda belum bisa membeli tiket. Untuk informasi lebih lanjut, silakan tanyakan kepada petugas yang berjaga di loket.",
    en: "We apologize, you cannot purchase tickets at this time. For more information, please ask the staff at the ticket counter.",
    zh: "非常抱歉，您目前无法购买门票。如需了解更多信息，请咨询售票处的工作人员。",
  },
  checkAgainButton: {
    id: "Periksa Lagi",
    en: "Check Again",
    zh: "重新查询",
  },
  checkingSession: {
    id: "Memeriksa sesi penjualan...",
    en: "Checking ticket session...",
    zh: "正在查询售票场次...",
  },

  cashInstruction: {
    id: "Tunjukkan nomor antrian ke kasir dan siapkan uang tunai pas untuk proses pembayaran.",
    en: "Show your queue number to the cashier and prepare exact cash for payment.",
    zh: "请向收银员出示排队号，并准备好现金以完成付款。",
  },

  // --- BARU: VisitorForm (dipindahkan dari LOCAL_STRINGS di VisitorForm.tsx) ---
  // Teks "memuat tiket" dan "tidak ada sesi aktif" memakai kunci yang sudah
  // ada di atas (`loadingTickets`, `noActiveSessionMessage`) karena isinya
  // identik di ketiga bahasa.
  noMatchingTickets: {
    id: "Pilihan lantai Anda tidak tersedia pada sesi saat ini. Silakan pilih ulang.",
    en: "Your floor selection is not available in the current session. Please select again.",
    zh: "您选择的楼层在当前场次中不可用，请重新选择。",
  },
  backToSelection: {
    id: "Pilih Ulang Lantai",
    en: "Reselect Floors",
    zh: "重新选择楼层",
  },
  customerNameLabel: {
    id: "Nama Pemesan",
    en: "Your Name",
    zh: "订购人姓名",
  },
  customerNamePlaceholder: {
    id: "Masukkan nama Anda",
    en: "Enter your name",
    zh: "请输入您的姓名",
  },
  customerNameRequired: {
    id: "Nama pemesan wajib diisi.",
    en: "Please enter your name.",
    zh: "请填写订购人姓名。",
  },
  visitorCountTitle: {
    id: "Jumlah Pengunjung",
    en: "Number of Visitors",
    zh: "参观人数",
  },
  visitorCountHint: {
    id: "Isi jumlah orang per kategori usia. Tiket dihitung otomatis untuk setiap lokasi yang Anda pilih.",
    en: "Enter how many people per age category. Tickets are calculated automatically for each location you selected.",
    zh: "请按年龄类别填写人数。系统会为您选择的每个区域自动计算门票。",
  },
  selectedLocations: {
    id: "Lokasi dipilih",
    en: "Selected locations",
    zh: "已选区域",
  },
  ticketMath: {
    id: "{people} orang × {floors} lokasi = {tickets} tiket",
    en: "{people} people × {floors} locations = {tickets} tickets",
    zh: "{people} 人 × {floors} 个区域 = {tickets} 张票",
  },
  totalTickets: {
    id: "Total Tiket",
    en: "Total Tickets",
    zh: "门票总数",
  },
  notAvailableEverywhere: {
    id: "Tidak tersedia di semua lokasi terpilih",
    en: "Not available at every selected location",
    zh: "并非所有已选区域都提供",
  },
  ticketUnit: {
    id: "tiket",
    en: "tickets",
    zh: "张票",
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