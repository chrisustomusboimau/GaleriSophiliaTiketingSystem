/**
 * VisitorForm.tsx
 * ----------------------------------------------------
 * Main form component for museum visitor data input.
 * Updated to match Galeria Sophilia Visual Identity.
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

/* =====================================================
   TYPES & INTERFACES
===================================================== */

interface VisitorCounts {
  child: number | string;
  student: number | string;
  adult: number | string;
}

interface CountryVisitor {
  countryCode: string;
  count: number | string;
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

const CounterInput: React.FC<CounterInputProps> = ({
  label,
  price,
  value,
  onChange,
}) => {
  const numericValue = Number(value) || 0;
  const subtotal = numericValue * price;
  const inputId = `counter-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      onChange("");
    } else {
      onChange(Math.max(0, parseInt(e.target.value) || 0));
    }
  };

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-[#fcfcfc] shadow-sm">
      <div className="flex justify-between mb-3">
        <label htmlFor={inputId} className="font-bold text-black cursor-pointer whitespace-pre-line">
          {label}
        </label>
        <span className="text-gray-600 font-medium">{formatCurrency(price)}</span>
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
          onKeyDown={(e) => { // DITAMBAHKAN
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
        <div className="mt-3 text-sm text-right text-gray-600">
          {numericValue} × {formatCurrency(price)} ={" "}
          <span className="font-bold text-black">
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
  const navigate = useNavigate();
  const location = useLocation();
  const { language, translations } = useLanguage();

  const selectedFloors: string[] = location.state?.selectedFloors || [];

  const [counts, setCounts] = useState<VisitorCounts>({
    child: 0,
    student: 0,
    adult: 0,
  });

  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFloors.length === 0) {
      navigate('/ticket-selection', { replace: true });
      return;
    }

    if (countryVisitors.length === 0) {
      setCountryVisitors([
        { countryCode: getDefaultCountryByLanguage(language), count: 1 },
      ]);
    }
  }, [language, navigate, selectedFloors.length]);

  const aggregatePrices = useMemo(
    () => calculateAggregatePrices(selectedFloors),
    [selectedFloors]
  );

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

  const totalPrice = useMemo(
    () => calculateTotalPrice(pureCounts, aggregatePrices),
    [pureCounts, aggregatePrices]
  );

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
          count: Number(c.count) || 0,
        })),
      };

      const response = await fetch("/api/v1/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

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

      const data = await response.json();
      if (!data || !data.id) throw new Error("Respon server tidak valid (ID tidak ditemukan).");

      navigate(`/queue/${data.id}`, {
        state: { origins: countryVisitors, totalVisitors, totalPrice },
      });

    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto text-black">
      <header className="mb-8">
        <h2 className="text-xl font-bold mb-2 text-black">
          {translations.visitorCount[language]}
        </h2>
        <p className="text-gray-600 text-sm">
          Anda memilih <span className="font-bold text-black">{selectedFloors.length} lantai</span>. Harga yang tertera adalah total biaya per orang untuk akses tersebut.
        </p>
      </header>

      {/* Age Category Inputs */}
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
      <div className="mb-8 p-5 border border-gray-200 rounded-xl bg-[#fcfcfc] shadow-sm">

        {/* HEADER NEGARA & INDIKATOR SINKRONISASI */}
        <div className="flex justify-between items-center mb-5 border-b border-gray-200 pb-3">
          <label className="block font-bold text-black">
            {translations.countryOrigin[language]}
          </label>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            totalVisitors !== totalFromCountries
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {totalFromCountries} / {totalVisitors} {translations.people[language]}
          </span>
        </div>

        <div className="space-y-4">
          {countryVisitors.map((country, index) => (
            <div key={index} className="flex flex-row items-center gap-3 w-full">
              <select
                value={country.countryCode}
                onChange={(e) => handleUpdateCountry(index, "countryCode", e.target.value)}
                onKeyDown={(e) => { // DITAMBAHKAN
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className="flex-[3] min-w-0 p-3 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] text-sm md:text-base truncate transition-shadow"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={country.count}
                onChange={(e) => handleUpdateCountry(index, "count", e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => { // DIPERBARUI: ditambah blur()
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
                  aria-label="Hapus negara"
                >
                  ✕
                </button>
              ) : (
                <div className="w-10 flex-none" />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddCountry}
          className="mt-5 font-bold text-[#fb9418] hover:text-orange-600 transition-colors flex items-center gap-1.5"
        >
          <span className="text-xl leading-none">+</span> {translations.addCountry[language]}
        </button>
      </div>

      {/* Summary Section */}
      <div className="mb-6 p-5 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-600 font-medium">{translations.totalVisitors[language]}</span>
          <span className="font-bold text-black">
            {totalVisitors} {translations.people[language]}
          </span>
        </div>
        <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-200">
          <span className="text-gray-800 font-bold">{translations.totalPrice[language]}</span>
          <span className="font-black text-2xl text-[#fb9418]">
            {formatCurrency(totalPrice)}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-4 font-bold text-[#fcfcfc] rounded-xl transition-all duration-200 shadow-md flex justify-center items-center ${
          isSubmitting
            ? "bg-gray-400 cursor-not-allowed shadow-none"
            : "bg-[#fb9418] hover:bg-orange-500 hover:shadow-lg active:scale-[0.98]"
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            {translations.processing[language]}
          </span>
        ) : (
          translations.getQueueButton[language]
        )}
      </button>
    </form>
  );
};

export default VisitorForm;