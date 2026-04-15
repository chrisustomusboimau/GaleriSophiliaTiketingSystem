/**
 * VisitorForm.tsx
 * ----------------------------------------------------
 * Main form component for museum visitor data input.
 * * Features:
 * - Input visitor counts by age category.
 * - Multi-country origin input with dynamic rows.
 * - Auto-calculates total visitors and total ticket price for UI preview.
 * - Submits data to the backend API to generate a secure ticket.
 * - Multi-language support via LanguageContext.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getData } from "country-list";
import {
  calculateTotalPrice,
  formatCurrency,
  PRICES,
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
  under8: number;
  under22: number;
  adult: number;
}

interface CountryVisitor {
  countryCode: string;
  count: number;
}

interface CounterInputProps {
  label: string;
  price: number;
  value: number;
  onChange: (value: number) => void;
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
  const subtotal = value * price;
  const inputId = `counter-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Math.max(0, Number(e.target.value) || 0));
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
          disabled={value === 0}
          onClick={() => onChange(Math.max(0, value - 1))}
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
          className="w-24 py-2 font-bold text-center border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
        />

        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-10 h-10 font-bold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition"
          aria-label={`Tambah ${label}`}
        >
          +
        </button>
      </div>

      {value > 0 && (
        <div className="mt-2 text-sm text-right text-gray-600">
          {value} × {formatCurrency(price)} ={" "}
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
  const { language, translations } = useLanguage();

  // --- State ---
  const [counts, setCounts] = useState<VisitorCounts>({
    under8: 0,
    under22: 0,
    adult: 0,
  });
  
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    if (countryVisitors.length === 0) {
      setCountryVisitors([
        { countryCode: getDefaultCountryByLanguage(language), count: 1 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // --- Derived Data (Memoized) ---
  const totalVisitors = useMemo(
    () => counts.under8 + counts.under22 + counts.adult,
    [counts]
  );

  const totalFromCountries = useMemo(
    () => countryVisitors.reduce((sum, c) => sum + c.count, 0),
    [countryVisitors]
  );

  // UI Only preview - backend will recalculate this securely
  const totalPrice = useMemo(
    () => calculateTotalPrice(counts.under8, counts.under22, counts.adult),
    [counts]
  );

  // --- Handlers ---
  const updateCount = (key: keyof VisitorCounts, value: number) => {
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
      prev.map((c, i) => (i === index ? { ...c, [key]: value } : c))
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

      // 1. Map frontend state to the API payload contract
      const payload = {
        under_8_count: counts.under8,
        under_22_count: counts.under22,
        adult_count: counts.adult,
        origins: countryVisitors.map((c) => ({
          country_code: c.countryCode,
          count: c.count,
        })),
      };

      // 2. Make the POST request to the backend
      // NOTE: Adjust the base URL if your API is hosted elsewhere 
      // (e.g., `${import.meta.env.VITE_API_BASE_URL}/api/v1/transactions`)
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
          // Attempt to extract FastAPI's specific error detail
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
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

      // 5. Navigate to the queue display page using the generated UUID
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
          {translations.visitorDescription[language]}
        </p>
      </header>

      {/* Age Category Inputs */}
      <CounterInput
        label={translations.childLabel[language]}
        price={PRICES.UNDER_8}
        value={counts.under8}
        onChange={(v) => updateCount("under8", v)}
      />
      <CounterInput
        label={translations.teenLabel[language]}
        price={PRICES.UNDER_22}
        value={counts.under22}
        onChange={(v) => updateCount("under22", v)}
      />
      <CounterInput
        label={translations.adultLabel[language]}
        price={PRICES.ADULT}
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
            <div key={index} className="flex flex-col md:flex-row items-stretch gap-2">
              <select
                value={country.countryCode}
                onChange={(e) => handleUpdateCountry(index, "countryCode", e.target.value)}
                className="w-full md:flex-1 p-3 bg-gray-100 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={country.count}
                  onChange={(e) => handleUpdateCountry(index, "count", Number(e.target.value))}
                  className="w-full md:w-20 p-3 text-center border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />

                {countryVisitors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCountry(index)}
                    className="px-2 text-xl font-bold text-red-500 hover:text-red-700 transition"
                    aria-label="Hapus negara"
                    title="Hapus negara"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddCountry}
          className="mt-4 font-medium text-blue-600 hover:text-blue-800 transition"
        >
          + {translations.addCountry[language]}
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