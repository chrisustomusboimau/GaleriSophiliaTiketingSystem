/**
 * VisitorForm.tsx
 * ----------------------------------------------------
 * Form input data pengunjung museum.
 *
 * PERUBAHAN INTI (v2) — INPUT PER VARIAN USIA, BUKAN PER LANTAI.
 *
 * Dulu form ini menampilkan satu counter untuk SETIAP kombinasi
 * lantai × varian: memilih 2 lantai berarti pengunjung harus mengisi
 * "Dewasa" dua kali, dan tidak ada yang mencegahnya mengisi angka yang
 * berbeda untuk orang yang sama.
 *
 * Sekarang counter-nya murni per VARIAN USIA (dari Master Varian Usia),
 * satu baris untuk "Dewasa" berapa pun lantai yang dipilih. Konsekuensinya
 * ada DUA angka berbeda yang harus dijaga tetap terpisah:
 *
 *   ORANG FISIK  = jumlah yang diketik pengunjung (mis. 2 Anak + 2 Dewasa
 *                  = 4 orang). Inilah dasar form kewarganegaraan — 4 orang
 *                  tetap 4 kewarganegaraan, berapa pun lantai yang dibeli.
 *
 *   UNIT TIKET   = orang × jumlah lantai (4 orang × 2 lantai = 8 tiket).
 *                  Inilah yang dikirim ke backend sebagai item transaksi,
 *                  dan yang menentukan total harga.
 *
 * Mencampur keduanya adalah kesalahan yang paling mudah terjadi di sini,
 * jadi keduanya dihitung terpisah dan diberi nama eksplisit di bawah
 * (`totalVisitors` vs `totalTickets`).
 */

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getData } from "country-list";
import { apiPost, ApiError } from "../api/client";
import { TransactionEntry, TransactionItemInput, PaymentMethod, SessionTicket } from "../types";
import { formatCurrency, resolveName } from "../utils/formatters";
import { useLanguage } from "../contexts/LanguageContext";
import { useActiveSession } from "../contexts/ActiveSessionContext";

/* =====================================================
   CONSTANTS & HELPERS
===================================================== */

const COUNTRIES = Object.freeze(
  getData().map((c) => ({
    code: c.code.toLowerCase(),
    name: c.name,
  }))
);

const getDefaultCountryByLanguage = (language: "id" | "en" | "zh"): string => {
  const languageToCountryMap: Record<string, string> = {
    id: "id",
    en: "us",
    zh: "cn",
  };
  return languageToCountryMap[language] || "id";
};

const LOCAL_STRINGS: Record<"id" | "en" | "zh", Record<string, string>> = {
  id: {
    loadingSession: "Memuat tiket yang tersedia...",
    noActiveSession: "Tidak ada sesi penjualan tiket yang sedang dibuka saat ini. Silakan coba lagi nanti.",
    noMatchingTickets: "Pilihan lantai Anda tidak tersedia pada sesi saat ini. Silakan pilih ulang.",
    backToSelection: "Pilih Ulang Lantai",
    customerNameLabel: "Nama Pemesan",
    customerNamePlaceholder: "Masukkan nama Anda",
    customerNameRequired: "Nama pemesan wajib diisi.",
    yearsOld: "tahun",
    visitorCountTitle: "Jumlah Pengunjung",
    visitorCountHint: "Isi jumlah orang per kategori usia. Tiket dihitung otomatis untuk setiap lokasi yang Anda pilih.",
    selectedLocations: "Lokasi dipilih",
    perLocation: "per lokasi",
    ticketMath: "{people} orang × {floors} lokasi = {tickets} tiket",
    totalTickets: "Total Tiket",
    notAvailableEverywhere: "Tidak tersedia di semua lokasi terpilih",
    perPerson: "orang",
    ticketUnit: "tiket",
  },
  en: {
    loadingSession: "Loading available tickets...",
    noActiveSession: "There is no open ticket session right now. Please try again later.",
    noMatchingTickets: "Your floor selection is not available in the current session. Please select again.",
    backToSelection: "Reselect Floors",
    customerNameLabel: "Your Name",
    customerNamePlaceholder: "Enter your name",
    customerNameRequired: "Please enter your name.",
    yearsOld: "years old",
    visitorCountTitle: "Number of Visitors",
    visitorCountHint: "Enter how many people per age category. Tickets are calculated automatically for each location you selected.",
    selectedLocations: "Selected locations",
    perLocation: "per location",
    ticketMath: "{people} people × {floors} locations = {tickets} tickets",
    totalTickets: "Total Tickets",
    notAvailableEverywhere: "Not available at every selected location",
    perPerson: "person",
    ticketUnit: "tickets",
  },
  zh: {
    loadingSession: "正在加载可购票种...",
    noActiveSession: "目前没有开放的售票场次，请稍后再试。",
    noMatchingTickets: "您选择的楼层在当前场次中不可用，请重新选择。",
    backToSelection: "重新选择楼层",
    customerNameLabel: "订购人姓名",
    customerNamePlaceholder: "请输入您的姓名",
    customerNameRequired: "请填写订购人姓名。",
    yearsOld: "岁",
    visitorCountTitle: "参观人数",
    visitorCountHint: "请按年龄类别填写人数。系统会为您选择的每个区域自动计算门票。",
    selectedLocations: "已选区域",
    perLocation: "每个区域",
    ticketMath: "{people} 人 × {floors} 个区域 = {tickets} 张票",
    totalTickets: "门票总数",
    notAvailableEverywhere: "并非所有已选区域都提供",
    perPerson: "人",
    ticketUnit: "张票",
  },
};

/* =====================================================
   TYPES & INTERFACES
===================================================== */

interface CountryVisitor {
  countryCode: string;
  count: number | string;
}

/** Satu lokasi yang menjual varian usia tertentu, beserta harganya di sana. */
interface VariantLocation {
  masterId: string;
  masterName: string;
  subCategoryId: string;
  price: number;
}

/**
 * Satu baris input di layar: SATU varian usia, berlaku untuk semua lokasi
 * terpilih yang menjualnya.
 */
interface AgeVariantRow {
  /** `age_category_id`, atau nama varian untuk data lama yang belum tertaut. */
  key: string;
  displayName: string;
  ageLabel: string;
  locations: VariantLocation[];
  /** Harga untuk SATU orang di SELURUH lokasi terpilih yang menjualnya. */
  totalPricePerPerson: number;
}

interface CounterInputProps {
  label: string;
  ageLabel: string;
  /** Harga total per orang untuk semua lokasi terpilih. */
  price: number;
  locations: VariantLocation[];
  /** Jumlah lokasi yang dipilih pengunjung — untuk peringatan ketersediaan. */
  selectedFloorCount: number;
  value: number | string;
  onChange: (value: number | string) => void;
  strings: Record<string, string>;
}

/* =====================================================
   SUB-COMPONENTS
===================================================== */

const CounterInput: React.FC<CounterInputProps> = ({
  label,
  ageLabel,
  price,
  locations,
  selectedFloorCount,
  value,
  onChange,
  strings,
}) => {
  const numericValue = Number(value) || 0;
  const subtotal = numericValue * price;
  const inputId = `counter-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const isPartial = locations.length < selectedFloorCount;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      onChange("");
    } else {
      onChange(Math.max(0, parseInt(e.target.value) || 0));
    }
  };

  return (
    <div className="mb-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="min-w-0">
          <label htmlFor={inputId} className="font-bold text-black cursor-pointer block">
            {label}
          </label>
          {ageLabel && (
            <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100 inline-block mt-1">
              {ageLabel}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-gray-800 font-bold block">{formatCurrency(price)}</span>
          <span className="text-[10px] text-gray-400 font-medium">/ {strings.perPerson}</span>
        </div>
      </div>

      {/* Rincian harga per lokasi — pengunjung berhak tahu total di atas
          berasal dari mana, terutama kalau harganya beda antar lantai. */}
      <div className="mb-3 space-y-0.5">
        {locations.map((loc) => (
          <div key={loc.subCategoryId} className="flex justify-between text-[11px] text-gray-500">
            <span className="truncate mr-2">{loc.masterName}</span>
            <span className="font-mono shrink-0">{formatCurrency(loc.price)}</span>
          </div>
        ))}
        {isPartial && (
          <p className="text-[11px] text-amber-600 font-medium pt-1">{strings.notAvailableEverywhere}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={numericValue <= 0}
          onClick={() => onChange(Math.max(0, numericValue - 1))}
          className="w-10 h-10 font-bold text-[#fcfcfc] bg-[#fb9418] border border-orange-200 rounded-full hover:bg-orange-500 transition-colors shadow-sm disabled:border-gray-200 disabled:text-gray-400 disabled:bg-gray-50"
          aria-label={`Kurangi ${label}`}
        >
          -
        </button>

        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="w-24 py-2 font-bold text-center text-black border border-gray-300 rounded-md focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none transition-shadow"
        />

        <button
          type="button"
          onClick={() => onChange(numericValue + 1)}
          className="w-10 h-10 font-bold text-[#fcfcfc] bg-[#fb9418] rounded-full hover:bg-orange-500 transition-colors shadow-sm"
          aria-label={`Tambah ${label}`}
        >
          +
        </button>
      </div>

      {numericValue > 0 && (
        <div className="mt-3 text-sm text-right text-gray-600 pt-2 border-t border-gray-100">
          {numericValue} × {formatCurrency(price)} ={" "}
          <span className="font-bold text-black">{formatCurrency(subtotal)}</span>
          <span className="block text-[11px] text-gray-400">
            {numericValue * locations.length} {strings.ticketUnit}
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================
// KOMPONEN SEARCHABLE COUNTRY SELECT
// =====================================================
const SearchableCountrySelect: React.FC<{
  value: string;
  onChange: (code: string) => void;
  countries: readonly { code: string; name: string }[];
  placeholderText: string;
  notFoundText: string;
}> = ({ value, onChange, countries, placeholderText, notFoundText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedCountry = countries.find((c) => c.code === value);
  const displayValue = isOpen ? searchTerm : selectedCountry?.name || "";

  const filteredCountries = countries.filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex-[3] min-w-0">
      <div
        className="flex items-center w-full bg-white border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-[#fb9418] focus-within:border-[#fb9418] transition-shadow cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="w-full p-3 bg-transparent outline-none text-sm md:text-base truncate"
          value={displayValue}
          placeholder={placeholderText}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm("");
          }}
        />
        <div className="pr-3 flex items-center pointer-events-none text-gray-400">
          <svg className={`w-4 h-4 transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
      </div>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-xl max-h-60 overflow-y-auto">
          {filteredCountries.length > 0 ? (
            filteredCountries.map((c) => (
              <li
                key={c.code}
                className={`px-4 py-2.5 cursor-pointer text-sm transition-colors
                  ${value === c.code ? "bg-orange-50 font-bold text-[#fb9418] border-l-4 border-[#fb9418]" : "text-gray-700 hover:bg-gray-50 hover:text-black"}
                `}
                onClick={() => {
                  onChange(c.code);
                  setIsOpen(false);
                  setSearchTerm("");
                }}
              >
                {c.name}
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-gray-500 italic text-center">{notFoundText}</li>
          )}
        </ul>
      )}
    </div>
  );
};

/* =====================================================
   MAIN COMPONENT
===================================================== */

const VisitorForm: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, translations } = useLanguage();
  const t = LOCAL_STRINGS[language] || LOCAL_STRINGS.id;

  const selectedFloors: string[] = location.state?.selectedFloors || [];

  const {
    session: activeSession,
    isLoading: isLoadingSession,
    error: sessionError,
  } = useActiveSession();

  const [counts, setCounts] = useState<Record<string, number | string>>({});
  const [customerName, setCustomerName] = useState("");
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // LOGIKA ANTI-SPAM (COOL-DOWN 10 MENIT)
  useEffect(() => {
    const cachedQueue = localStorage.getItem("sophilia_active_queue");
    if (cachedQueue) {
      try {
        const parsed = JSON.parse(cachedQueue);
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;

        if (now - parsed.timestamp < tenMinutes) {
          navigate(`/queue/${parsed.id}`, { state: parsed.state, replace: true });
        } else {
          localStorage.removeItem("sophilia_active_queue");
        }
      } catch (e) {
        localStorage.removeItem("sophilia_active_queue");
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (selectedFloors.length === 0) {
      navigate("/ticket-selection", { replace: true });
      return;
    }

    if (countryVisitors.length === 0) {
      setCountryVisitors([{ countryCode: getDefaultCountryByLanguage(language), count: 0 }]);
    }
  }, [language, navigate, selectedFloors.length]);

  const relevantTickets = useMemo<SessionTicket[]>(() => {
    if (!activeSession) return [];
    return activeSession.active_tickets.filter((st) => {
      const sub = st.sub_category;
      if (!sub) return false;
      return selectedFloors.includes(sub.ticket_master_id);
    });
  }, [activeSession, selectedFloors]);

  /**
   * Menggabungkan varian yang sama LINTAS LOKASI jadi satu baris input.
   *
   * Kuncinya `age_category_id` dari Master Varian Usia — itulah yang
   * membuat "Dewasa" di Lantai 1 dan "Dewasa" di Lantai 2 dikenali sebagai
   * varian yang SAMA. Untuk data lama yang belum tertaut master (hasil
   * migrasi yang tidak menemukan padanan), jatuh ke nama varian: hasilnya
   * tetap tergabung selama namanya konsisten, dan kalau tidak, paling
   * buruk kembali ke perilaku lama (satu baris per lantai).
   */
  const ageVariants: AgeVariantRow[] = useMemo(() => {
    const map = new Map<string, AgeVariantRow>();

    relevantTickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;

      const key = sub.age_category_id || `name:${sub.name}`;
      const masterName = resolveName(
        sub.ticket_master_name_i18n,
        language,
        sub.ticket_master_name || "Tiket"
      );

      if (!map.has(key)) {
        // Rentang usia dibaca dari min_age/max_age — nama field yang
        // benar-benar dikirim backend (`TicketSubCategoryRead`).
        let ageLabel = "";
        if (sub.max_age !== null && sub.max_age !== undefined) {
          ageLabel = `${sub.min_age} - ${sub.max_age} ${t.yearsOld}`;
        } else {
          ageLabel = `${sub.min_age}+ ${t.yearsOld}`;
        }

        map.set(key, {
          key,
          displayName: resolveName(sub.name_i18n, language, sub.name),
          ageLabel,
          locations: [],
          totalPricePerPerson: 0,
        });
      }

      const row = map.get(key)!;
      row.locations.push({
        masterId: sub.ticket_master_id,
        masterName,
        subCategoryId: sub.id,
        price: sub.price,
      });
      row.totalPricePerPerson += sub.price;
    });

    // Urutkan menurut usia minimum lewat urutan kemunculan lokasi pertama,
    // supaya Anak selalu di atas Dewasa seperti di katalog.
    return Array.from(map.values());
  }, [relevantTickets, language, t]);

  useEffect(() => {
    if (ageVariants.length === 0) return;
    setCounts((prev) => {
      const next: Record<string, number | string> = {};
      ageVariants.forEach((v) => {
        next[v.key] = prev[v.key] ?? 0;
      });
      return next;
    });
  }, [ageVariants]);

  const pureCounts = useMemo(() => {
    const result: Record<string, number> = {};
    ageVariants.forEach((v) => {
      result[v.key] = Number(counts[v.key]) || 0;
    });
    return result;
  }, [counts, ageVariants]);

  /** ORANG FISIK — dasar form kewarganegaraan. TIDAK dikali jumlah lokasi. */
  const totalVisitors = useMemo(
    () => ageVariants.reduce((sum, v) => sum + (pureCounts[v.key] || 0), 0),
    [ageVariants, pureCounts]
  );

  /** UNIT TIKET — orang × lokasi yang menjual varian itu. */
  const totalTickets = useMemo(
    () => ageVariants.reduce((sum, v) => sum + (pureCounts[v.key] || 0) * v.locations.length, 0),
    [ageVariants, pureCounts]
  );

  const totalFromCountries = useMemo(
    () => countryVisitors.reduce((sum, c) => sum + (Number(c.count) || 0), 0),
    [countryVisitors]
  );

  const totalPrice = useMemo(
    () => ageVariants.reduce((sum, v) => sum + (pureCounts[v.key] || 0) * v.totalPricePerPerson, 0),
    [ageVariants, pureCounts]
  );

  /** Nama lokasi terpilih, untuk ditampilkan di ringkasan atas. */
  const selectedLocationNames = useMemo(() => {
    const names = new Map<string, string>();
    ageVariants.forEach((v) =>
      v.locations.forEach((loc) => {
        if (!names.has(loc.masterId)) names.set(loc.masterId, loc.masterName);
      })
    );
    return Array.from(names.values());
  }, [ageVariants]);

  const updateCount = (key: string, value: number | string) => {
    setCounts((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddCountry = () => {
    setCountryVisitors((prev) => [...prev, { countryCode: getDefaultCountryByLanguage(language), count: 0 }]);
  };

  const handleUpdateCountry = (index: number, key: keyof CountryVisitor, value: string | number) => {
    setCountryVisitors((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        if (key === "countryCode") return { ...c, countryCode: value as string };
        if (key === "count") return { ...c, count: value === "" ? "" : Math.max(0, parseInt(value as string) || 0) };
        return c;
      })
    );
  };

  const handleRemoveCountry = (index: number) => {
    setCountryVisitors((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!customerName.trim()) {
      setError(t.customerNameRequired);
      return false;
    }
    if (totalVisitors === 0) {
      setError(translations.visitorAmountRequired[language]);
      return false;
    }
    // Dibandingkan dengan ORANG FISIK, bukan unit tiket: 4 orang yang
    // membeli 2 lantai tetap mengisi 4 kewarganegaraan, bukan 8.
    if (totalVisitors !== totalFromCountries) {
      setError(translations.visitorAmountError[language]);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      // Di sinilah orang fisik diterjemahkan jadi unit tiket: satu item
      // per (varian × lokasi), masing-masing sebanyak jumlah orangnya.
      const items: TransactionItemInput[] = [];
      ageVariants.forEach((variant) => {
        const qty = pureCounts[variant.key] || 0;
        if (qty <= 0) return;
        variant.locations.forEach((loc) => {
          items.push({ ticket_sub_category_id: loc.subCategoryId, quantity: qty });
        });
      });

      const payload = {
        customer_name: customerName.trim(),
        items,
        origins: countryVisitors.map((c) => ({
          country_code: c.countryCode,
          count: Number(c.count) || 0,
        })),
        payment_method: paymentMethod,
      };

      const data = await apiPost<TransactionEntry>("/transactions", payload, { skipAuthRedirect: true });

      const responseState = {
        origins: countryVisitors,
        totalVisitors,
        totalTickets,
        totalPrice,
        paymentMethod,
        ticketCode: data.ticket_code,
        queueNumber: data.queue_number,
      };

      localStorage.setItem(
        "sophilia_active_queue",
        JSON.stringify({ id: data.id, timestamp: Date.now(), state: responseState })
      );

      navigate(`/queue/${data.id}`, { state: responseState, replace: true });
    } catch (err: any) {
      console.error("Submission error:", err);

      if (err instanceof ApiError && err.status === 403) {
        navigate("/tickets-unavailable", { replace: true });
        return;
      }

      setError(err instanceof ApiError ? err.message : err?.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingSession) {
    return (
      <div className="max-w-md mx-auto text-black pb-8 text-center py-16">
        <p className="text-gray-400 font-medium">{t.loadingSession}</p>
      </div>
    );
  }

  if (sessionError || !activeSession) {
    return (
      <div className="max-w-md mx-auto text-black pb-8 text-center py-16 px-4">
        <div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm mb-6">
          {sessionError || t.noActiveSession}
        </div>
        <button
          type="button"
          onClick={() => navigate("/ticket-selection")}
          className="px-5 py-3 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all"
        >
          {t.backToSelection}
        </button>
      </div>
    );
  }

  if (ageVariants.length === 0) {
    return (
      <div className="max-w-md mx-auto text-black pb-8 text-center py-16 px-4">
        <div className="p-5 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm mb-6">{t.noMatchingTickets}</div>
        <button
          type="button"
          onClick={() => navigate("/ticket-selection")}
          className="px-5 py-3 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all"
        >
          {t.backToSelection}
        </button>
      </div>
    );
  }

  const ticketMathText = t.ticketMath
    .replace("{people}", String(totalVisitors))
    .replace("{floors}", String(selectedLocationNames.length))
    .replace("{tickets}", String(totalTickets));

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto text-black pb-8">
      {/* Nama Pemesan */}
      <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-[#fcfcfc] shadow-sm">
        <label htmlFor="customer-name" className="block font-bold text-black mb-2">
          {t.customerNameLabel}
        </label>
        <input
          id="customer-name"
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder={t.customerNamePlaceholder}
          required
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white font-medium transition-shadow"
        />
      </div>

      {/* Jumlah pengunjung — PER VARIAN USIA, berlaku untuk semua lokasi */}
      <div className="mb-6 p-5 border border-orange-100 rounded-xl bg-orange-50/30 shadow-sm">
        <div className="mb-4 border-b border-orange-200 pb-3">
          <h3 className="font-extrabold text-lg text-black flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#fb9418]"></span>
            {t.visitorCountTitle}
          </h3>
          <p className="text-xs text-gray-500 mt-1.5">{t.visitorCountHint}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              {t.selectedLocations}:
            </span>
            {selectedLocationNames.map((name) => (
              <span
                key={name}
                className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-[#fb9418] border border-orange-200"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          {ageVariants.map((variant) => (
            <CounterInput
              key={variant.key}
              label={variant.displayName}
              ageLabel={variant.ageLabel}
              price={variant.totalPricePerPerson}
              locations={variant.locations}
              selectedFloorCount={selectedLocationNames.length}
              value={counts[variant.key] ?? 0}
              onChange={(v) => updateCount(variant.key, v)}
              strings={t}
            />
          ))}
        </div>
      </div>

      {/* Multi-Citizenship / Country Input Section */}
      <div className="mb-8 p-5 border border-gray-200 rounded-xl bg-[#fcfcfc] shadow-sm">
        <div className="flex justify-between items-center mb-5 border-b border-gray-200 pb-3">
          <label className="block font-bold text-black">
            {translations.citizenship?.[language] || "Kewarganegaraan"}
          </label>
          {/* Dibandingkan dengan ORANG FISIK, bukan unit tiket. */}
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              totalVisitors !== totalFromCountries ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            {totalFromCountries} / {totalVisitors} {translations.people[language]}
          </span>
        </div>

        <div className="space-y-4">
          {countryVisitors.map((country, index) => (
            <div key={index} className="flex flex-row items-center gap-3 w-full">
              <SearchableCountrySelect
                value={country.countryCode}
                onChange={(newCode) => handleUpdateCountry(index, "countryCode", newCode)}
                countries={COUNTRIES}
                placeholderText={translations.selectCitizenship?.[language] || translations.searchCountryPlaceholder[language]}
                notFoundText={translations.countryNotFound[language]}
              />

              <input
                type="number"
                min={0}
                value={country.count}
                onChange={(e) => handleUpdateCountry(index, "count", e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className="flex-1 min-w-0 p-3 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white font-bold transition-shadow"
              />

              {countryVisitors.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveCountry(index)}
                  className="flex-none w-10 h-10 flex items-center justify-center font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors border border-transparent"
                  aria-label="Hapus"
                >
                  ✕
                </button>
              ) : (
                <div className="w-10 flex-none" />
              )}
            </div>
          ))}
        </div>

        <button type="button" onClick={handleAddCountry} className="mt-5 font-bold text-[#fb9418] hover:text-orange-600 transition-colors flex items-center gap-1.5">
          <span className="text-xl leading-none">+</span> {translations.addCountry[language]}
        </button>
      </div>

      {/* Payment Method Selection */}
      <div className="mb-6 p-5 border border-gray-200 rounded-xl bg-[#fcfcfc] shadow-sm">
        <label className="block font-bold text-black mb-4">{translations.paymentMethod[language]}</label>
        <div className="grid grid-cols-2 gap-3">
          <label
            className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
              paymentMethod === "qris" ? "border-[#fb9418] bg-orange-50 text-[#fb9418] font-bold shadow-sm" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <input type="radio" name="paymentMethod" value="qris" checked={paymentMethod === "qris"} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="hidden" />
            QRIS
          </label>
          <label
            className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all text-center leading-tight ${
              paymentMethod === "card" ? "border-[#fb9418] bg-orange-50 text-[#fb9418] font-bold shadow-sm" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <input type="radio" name="paymentMethod" value="card" checked={paymentMethod === "card"} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="hidden" />
            {translations.creditDebitCard[language]}
          </label>
        </div>
      </div>

      {/* Summary Section — ORANG vs TIKET ditampilkan terpisah supaya
          pengunjung tidak kaget melihat jumlah tiket lebih besar. */}
      <div className="mb-6 p-5 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600 font-medium">{translations.totalVisitors[language]}</span>
          <span className="font-bold text-black">
            {totalVisitors} {translations.people[language]}
          </span>
        </div>
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600 font-medium">{t.totalTickets}</span>
          <span className="font-bold text-black">{totalTickets}</span>
        </div>
        {totalVisitors > 0 && selectedLocationNames.length > 1 && (
          <p className="text-[11px] text-gray-400 font-medium">{ticketMathText}</p>
        )}
        <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-200">
          <span className="text-gray-800 font-bold">{translations.totalPrice[language]}</span>
          <span className="font-black text-2xl text-[#fb9418]">{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Tombol Kembali & Submit */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={isSubmitting}
          className="flex-1 py-4 font-bold text-black bg-white border border-gray-300 hover:bg-gray-100 rounded-xl transition-all duration-200 flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {translations.backButton?.[language] || "Kembali"}
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex-1 py-4 font-bold text-[#fcfcfc] rounded-xl transition-all duration-200 shadow-md flex justify-center items-center ${
            isSubmitting ? "bg-gray-400 cursor-not-allowed shadow-none" : "bg-[#fb9418] hover:bg-orange-500 hover:shadow-lg active:scale-[0.98]"
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {translations.processing[language]}
            </span>
          ) : (
            translations.getQueueButton[language]
          )}
        </button>
      </div>
    </form>
  );
};

export default VisitorForm;
