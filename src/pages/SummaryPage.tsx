/**
 * SummaryPage.tsx
 * ----------------------------------------------------
 * Halaman khusus untuk menampilkan Ringkasan Transaksi.
 * UPDATE: Halaman ini sekarang mandiri (mengambil data sendiri dari server)
 * sehingga memiliki filter terpisah yang tidak terhubung dengan PaymentHistoryPage.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Summary from "../components/Summary";
import { Transaction } from "../components/PaymentHistoryComponent";

const SummaryPage: React.FC = () => {
  const navigate = useNavigate();

  // Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // --- States ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(getTodayString());

  // --- Auth & Data Fetching ---
  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    const tokenType = localStorage.getItem("token_type") ?? "Bearer";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
    };
  };

  const loadTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let url = "/api/v1/transactions/all";
      if (statusFilter !== "all") {
        url += `?status=${statusFilter}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          localStorage.removeItem("token_type");
          navigate("/login", { replace: true });
          return;
        }
        throw new Error("Gagal mengambil data riwayat transaksi.");
      }

      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (err: any) {
      console.error("Error loading transactions:", err);
      setError(err.message || "Gagal memuat data. Periksa koneksi Anda.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, navigate]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // --- Filter Client-Side ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Filter Metode Pembayaran
      if (paymentFilter !== "all" && tx.payment_method !== paymentFilter) {
        return false;
      }
      // Filter Tanggal
      if (dateFilter) {
        if (!tx.created_at) return false;
        const txDate = new Date(tx.created_at);
        const yyyy = txDate.getFullYear();
        const mm = String(txDate.getMonth() + 1).padStart(2, "0");
        const dd = String(txDate.getDate()).padStart(2, "0");
        const formattedTxDate = `${yyyy}-${mm}-${dd}`;
        if (formattedTxDate !== dateFilter) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, paymentFilter, dateFilter]);

  // --- Kalkulasi Data Summary ---
  const summaryStats = useMemo(() => {
    let totalChildren = 0;
    let totalTeens = 0;
    let totalAdults = 0;
    let totalRevenue = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.status === "paid" || tx.status === "confirmed") {
        totalRevenue += tx.total_price || 0;
      }

      const uniqueCounts = { adult: 0, student: 0, child: 0 };
      tx.items.forEach((item) => {
        const cat = item.age_category.toLowerCase();
        if (cat === "adult") {
          uniqueCounts.adult = Math.max(uniqueCounts.adult, item.quantity);
        } else if (cat === "student" || cat === "teen") {
          uniqueCounts.student = Math.max(uniqueCounts.student, item.quantity);
        } else if (cat === "child") {
          uniqueCounts.child = Math.max(uniqueCounts.child, item.quantity);
        }
      });

      totalChildren += uniqueCounts.child;
      totalTeens += uniqueCounts.student;
      totalAdults += uniqueCounts.adult;
    });

    return {
      totalVisitors: totalChildren + totalTeens + totalAdults,
      totalChildren,
      totalTeens,
      totalAdults,
      totalRevenue,
    };
  }, [filteredTransactions]);

  // --- Label Indikator Ringkasan Filter ---
  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (dateFilter) {
      const [yyyy, mm, dd] = dateFilter.split("-");
      parts.push(`Tanggal: ${dd}/${mm}/${yyyy}`);
    } else {
      parts.push("Semua Waktu");
    }
    if (statusFilter !== "all") {
      parts.push(statusFilter === "confirmed" ? "Lunas" : statusFilter === "pending" ? "Pending" : "Batal");
    }
    if (paymentFilter !== "all") {
      parts.push(paymentFilter === "qris" ? "QRIS" : "EDC");
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [statusFilter, paymentFilter, dateFilter]);

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans text-black">
      
      {/* HEADER TEMA GALERIA SOPHILIA */}
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <div className="flex flex-col select-none cursor-pointer" onClick={() => navigate("/admin/history")}>
            <h2 className="text-[#fcfcfc] font-light tracking-[0.3em] text-[10px] sm:text-xs uppercase ml-0.5">
              Galeria
            </h2>
            <h1 className="text-[#fb9418] font-bold tracking-wider text-xl sm:text-2xl uppercase leading-none mt-0.5">
              Sophilia
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin/history")}
              className="text-xs sm:text-sm font-bold px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Kembali
            </button>
          </div>
        </div>
      </header>

      {/* KONTEN UTAMA SUMMARY */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          <header className="border-b-2 border-gray-200 pb-5 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-6 mt-2">
            <div>
              <h2 className="text-2xl font-bold text-black uppercase tracking-wider">
                Ringkasan Laporan
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Data ringkasan berikut didasarkan pada filter spesifik di bawah ini.
              </p>
            </div>

            {/* BARIS FILTER MANDIRI SUMMARY */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* FILTER TANGGAL */}
              <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-[#fb9418] focus-within:border-[#fb9418] cursor-pointer">
                <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="text-sm font-bold text-black outline-none bg-transparent cursor-pointer"
                  title="Filter Berdasarkan Tanggal"
                />
              </div>

              {/* FILTER STATUS */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border-gray-300 rounded-lg shadow-sm text-sm font-bold text-black focus:ring-[#fb9418] focus:border-[#fb9418] py-2 px-3 border outline-none cursor-pointer h-[38px]"
              >
                <option value="all">Semua Status</option>
                <option value="confirmed">Lunas / Dikonfirmasi</option>
                <option value="pending">Menunggu (Pending)</option>
                <option value="cancelled">Batal (Cancelled)</option>
              </select>

              {/* FILTER METODE PEMBAYARAN */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white text-sm font-bold h-[38px]">
                {(
                  [
                    { value: "all",  label: "Semua" },
                    { value: "qris", label: "QRIS"  },
                    { value: "card", label: "EDC"   },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentFilter(value)}
                    className={`px-4 py-1 transition-colors focus:outline-none ${
                      paymentFilter === value
                        ? value === "card"
                          ? "bg-black text-white"
                          : "bg-[#fb9418] text-white"
                        : "text-gray-600 hover:bg-gray-50"
                    } ${value !== "all" ? "border-l border-gray-300" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* TOMBOL REFRESH */}
              <button
                onClick={loadTransactions}
                disabled={isLoading}
                className="text-sm font-bold px-4 py-2 bg-white border border-gray-300 rounded-lg text-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 transition-colors shadow-sm h-[38px]"
              >
                {isLoading ? "Memuat..." : "Refresh"}
              </button>
            </div>
          </header>

          {/* BADGE FILTER AKTIF */}
          {activeFilterLabel && (
            <div className="flex flex-wrap items-center gap-2 -mt-4">
              <span className="text-xs text-gray-500 font-medium">Filter aktif:</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#fb9418] border border-orange-200">
                {activeFilterLabel}
                <span className="font-black text-black ml-1">
                  ({filteredTransactions.length} Transaksi)
                </span>
              </span>
              <button
                onClick={() => { 
                  setStatusFilter("all"); 
                  setPaymentFilter("all"); 
                  setDateFilter(""); 
                }}
                className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors underline underline-offset-2 ml-2"
              >
                Reset Semua Filter
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm flex items-center gap-3">
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* MENAMPILKAN KOMPONEN SUMMARY */}
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-12 h-12 border-4 border-[#fb9418] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <Summary
              totalVisitors={summaryStats.totalVisitors}
              totalChildren={summaryStats.totalChildren}
              totalTeens={summaryStats.totalTeens}
              totalAdults={summaryStats.totalAdults}
              totalRevenue={summaryStats.totalRevenue}
              transactions={filteredTransactions}
            />
          )}
          
        </div>
      </main>
    </div>
  );
};

export default SummaryPage;