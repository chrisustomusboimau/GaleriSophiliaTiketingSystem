/**
 * VisitorForm.tsx
 * ----------------------------------------------------
 * Main form component for museum visitor data input.
 * * Features:
 * - Retrieves selected floors from the previous page.
 * - Calculates aggregate ticket prices based on selected floors.
 * - Input visitor counts by age category.
 * - Multi-country origin input with dynamic rows.
 * - Submits data to the backend API as an array of items.
 * - Multi-language support via LanguageContext.
 * - FIX: Resolved the backspace "0" bug for numeric inputs.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getData } from "country-list";
import {
  calculateAggregatePrices,
  calculateTotalPrice,
  formatCurrency,
} from "../utils/priceCalculator";
import { useLanguage } from "../contexts/LanguageContext";

/* =====================================================
   CONSTANTS & HELPERS
===================================================== */

/** Pre-computed array of countries for the dropdown */
const COUNTRIES = Object.freeze(
  getData().map((c) => ({
    code: c.code.toLowerCase(),
    name: c.name,
  }))
);

/**
 * Maps a language code to a default country code.
 */
const getDefaultCountryByLanguage = (language: "id" | "en" | "zh"): string => {
  const languageToCountryMap: Record<string, string> = {
    id: "id",
    en: "us",
    zh: "cn",
  };
  return languageToCountryMap[language] || "id";
};

/* =====================================================
   TYPES & INTERFACES
===================================================== */

interface VisitorCounts {
  child: number | string;   // DIBERIKAN IZIN MENJADI STRING AGAR BISA ""
  student: number | string; // DIBERIKAN IZIN MENJADI STRING AGAR BISA ""
  adult: number | string;   // DIBERIKAN IZIN MENJADI STRING AGAR BISA ""
}

interface CountryVisitor {
  countryCode: string;
  count: number | string; // Diberikan izin untuk origin input juga
}

interface CounterInputProps {
  label: string;
  price: number;
  value: number | string;
  onChange: (value: number | string) => void;
}

/* =====================================================
   SUB-COMPONENTS
===================================================== */

/**
 * Component for incrementing/decrementing visitor counts by age.
 */
const CounterInput: React.FC<CounterInputProps> = ({
  label,
  price,
  value,
  onChange,
}) => {
  // Pastikan value di-convert ke number untuk perhitungan UI
  const numericValue = Number(value) || 0;
  const subtotal = numericValue * price;
  const inputId = `counter-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // FIX: Jika string kosong, simpan sebagai string kosong. Jika tidak, parse ke angka.
    if (e.target.value === "") {
      onChange("");
    } else {
      onChange(Math.max(0, parseInt(e.target.value) || 0));
    }
  };

  return (
    <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex justify-between mb-2">
        <label htmlFor={inputId} className="font-medium cursor-pointer whitespace-pre-line">
          {label}
        </label>
        <span className="text-gray-600">{formatCurrency(price)}</span>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={numericValue <= 0}
          onClick={() => onChange(Math.max(0, numericValue - 1))}
          className="w-10 h-10 font-bold text-blue-600 bg-blue-100 rounded-full disabled:opacity-50 transition"
          aria-label={`Kurangi ${label}`}
        >
          -
        </button>

        <input
          id={inputId}
          type="number"
          min={0}
          value={value}
          onChange={handleInputChange}
          onFocus={(e) => e.target.select()} // FIX TAMBAHAN: Auto-select saat di-klik
          className="w-24 py-2 font-bold text-center border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
        />

        <button
          type="button"
          onClick={() => onChange(numericValue + 1)}
          className="w-10 h-10 font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition"
          aria-label={`Tambah ${label}`}
        >
          +
        </button>
      </div>

      {numericValue > 0 && (
        <div className="mt-2 text-sm text-right text-gray-600">
          {numericValue} × {formatCurrency(price)} ={" "}
          <span className="font-medium text-blue-700">
            {formatCurrency(subtotal)}
          </span>
        </div>
      )}
    </div>
  );
};

/* =====================================================
   MAIN COMPONENT
===================================================== */

const VisitorForm: React.FC = () => {
  // --- Hooks ---
  const navigate = useNavigate();
  const location = useLocation();
  const { language, translations } = useLanguage();

  // Retrieve selected floors from the TicketSelectionPage
  const selectedFloors: string[] = location.state?.selectedFloors || [];

  // --- State ---
  const [counts, setCounts] = useState<VisitorCounts>({
    child: 0,
    student: 0,
    adult: 0,
  });
  
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    // Security check: If users arrive here without selecting a floor, kick them back
    if (selectedFloors.length === 0) {
      navigate('/ticket-selection', { replace: true });
      return;
    }

    if (countryVisitors.length === 0) {
      setCountryVisitors([
        { countryCode: getDefaultCountryByLanguage(language), count: 1 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, navigate, selectedFloors.length]); 

  // --- Derived Data (Memoized) ---
  
  // 1. Calculate the combined price per person based on selected floors
  const aggregatePrices = useMemo(
    () => calculateAggregatePrices(selectedFloors),
    [selectedFloors]
  );

  // Parse counts to pure numbers for accurate math
  const pureCounts = useMemo(() => ({
    child: Number(counts.child) || 0,
    student: Number(counts.student) || 0,
    adult: Number(counts.adult) || 0,
  }), [counts]);

  const totalVisitors = useMemo(
    () => pureCounts.child + pureCounts.student + pureCounts.adult,
    [pureCounts]
  );

  const totalFromCountries = useMemo(
    () => countryVisitors.reduce((sum, c) => sum + (Number(c.count) || 0), 0),
    [countryVisitors]
  );

  // 2. Calculate final grand total for the UI preview
  const totalPrice = useMemo(
    () => calculateTotalPrice(pureCounts, aggregatePrices),
    [pureCounts, aggregatePrices]
  );

  // --- Handlers ---
  const updateCount = (key: keyof VisitorCounts, value: number | string) => {
    setCounts((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddCountry = () => {
    setCountryVisitors((prev) => [...prev, { countryCode: "id", count: 1 }]);
  };

const handleUpdateCountry = (
    index: number,
    key: keyof CountryVisitor,
    value: string | number
  ) => {
    setCountryVisitors((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;

        // Perbaikan TypeScript: Pisahkan logika berdasarkan key-nya secara eksplisit
        if (key === "countryCode") {
          return { ...c, countryCode: value as string };
        }

        if (key === "count") {
          // Menangani bug backspace (mengizinkan string kosong sementara)
          return {
            ...c,
            count: value === "" ? "" : Math.max(0, parseInt(value as string) || 0),
          };
        }

        return c;
      })
    );
  };

  const handleRemoveCountry = (index: number) => {
    setCountryVisitors((prev) => prev.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (totalVisitors === 0) {
      setError(translations.visitorAmountRequired[language]);
      return false;
    }
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

      // 1. Map frontend state to the new API payload contract (Itemized per floor)
      const items: { floor: string; age_category: string; quantity: number }[] = [];
      
      selectedFloors.forEach(floor => {
        if (pureCounts.adult > 0) items.push({ floor, age_category: 'adult', quantity: pureCounts.adult });
        if (pureCounts.student > 0) items.push({ floor, age_category: 'student', quantity: pureCounts.student });
        if (pureCounts.child > 0) items.push({ floor, age_category: 'child', quantity: pureCounts.child });
      });

      const payload = {
        items,
        origins: countryVisitors.map((c) => ({
          country_code: c.countryCode,
          count: Number(c.count) || 0, // Pastikan dikirim sebagai number murni
        })),
      };

      // 2. Make the POST request to the backend
      const response = await fetch("/api/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // 3. Handle non-2xx HTTP responses
      if (!response.ok) {
        let errorMessage = "Terjadi kesalahan pada server. Silakan coba lagi.";
        try {
          const errorData = await response.json();
          if (errorData.detail) errorMessage = errorData.detail;
        } catch (parseError) {
          console.warn("Failed to parse error response from server");
        }
        throw new Error(errorMessage);
      }

      // 4. Parse successful response
      const data = await response.json();

      if (!data || !data.id) {
        throw new Error("Respon server tidak valid (ID tidak ditemukan).");
      }

      // 5. Navigate to the queue display page
      navigate(`/queue/${data.id}`, {
        state: {
          origins: countryVisitors,
          totalVisitors,
          totalPrice,
        },
      });

    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render ---
  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <header className="mb-6">
        <h2 className="text-xl font-bold mb-1">
          {translations.visitorCount[language]}
        </h2>
        <p className="text-gray-600">
          Anda memilih {selectedFloors.length} lantai. Harga yang tertera adalah total biaya per orang untuk akses tersebut.
        </p>
      </header>

      {/* Age Category Inputs mapped to aggregated floor prices */}
      <CounterInput
        label={translations.childLabel[language]}
        price={aggregatePrices.child}
        value={counts.child}
        onChange={(v) => updateCount("child", v)}
      />
      <CounterInput
        label={translations.teenLabel[language]}
        price={aggregatePrices.student}
        value={counts.student}
        onChange={(v) => updateCount("student", v)}
      />
      <CounterInput
        label={translations.adultLabel[language]}
        price={aggregatePrices.adult}
        value={counts.adult}
        onChange={(v) => updateCount("adult", v)}
      />

      {/* Multi-Country Input Section */}
      <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
        <label className="block mb-4 font-medium">
          {translations.countryOrigin[language]}
        </label>

        <div className="space-y-3">
          {countryVisitors.map((country, index) => (
            <div key={index} className="flex flex-row items-center gap-2 w-full">
              {/* 1. Select Negara: Mengambil ruang paling besar (misal 70% atau flex-grow) */}
              <select
                value={country.countryCode}
                onChange={(e) => handleUpdateCountry(index, "countryCode", e.target.value)}
                className="flex-[3] min-w-0 p-3 bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm md:text-base truncate"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* 2. Input Angka: Ukuran sedang (misal flex-1) */}
              <input
                type="number"
                min={1}
                value={country.count}
                onChange={(e) => handleUpdateCountry(index, "count", e.target.value)}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 p-3 text-center border rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
              />

              {/* 3. Tombol Hapus: Mengambil ruang paling sedikit atau tetap */}
              {countryVisitors.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveCountry(index)}
                  className="flex-none w-10 h-10 flex items-center justify-center font-bold text-red-500 hover:bg-red-50 rounded-full transition-colors border border-transparent hover:border-red-100"
                  aria-label="Hapus negara"
                >
                  ✕
                </button>
              ) : (
                // Placeholder agar layout tetap simetris meski tombol hapus tidak ada
                <div className="w-10 flex-none" />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddCountry}
          className="mt-4 font-medium text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
        >
          <span className="text-lg">+</span> {translations.addCountry[language]}
        </button>
      </div>

      {/* Summary Section */}
      <div className="mb-4 p-4 rounded-lg bg-blue-50">
        <div className="flex justify-between mb-2">
          <span>{translations.totalVisitors[language]}</span>
          <span className="font-bold">
            {totalVisitors} {translations.people[language]}
          </span>
        </div>
        <div className="flex justify-between text-lg">
          <span>{translations.totalPrice[language]}</span>
          <span className="font-bold text-blue-700">
            {formatCurrency(totalPrice)}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 font-medium text-white rounded-lg transition-colors duration-200 ${
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 shadow-md"
        }`}
      >
        {isSubmitting
          ? translations.processing[language]
          : translations.getQueueButton[language]}
      </button>
    </form>
  );
};

export default VisitorForm;