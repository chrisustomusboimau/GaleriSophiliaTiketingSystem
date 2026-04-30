/**
 * PaymentHistoryPage.tsx
 * ----------------------------------------------------
 * Main page integrating the PaymentHistoryComponent.
 * Diperbarui dengan identitas visual Galeria Sophilia (Putih/Hitam/Oranye).
 * UPDATE: Komponen Summary dipindahkan ke halaman terpisah.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import PaymentHistoryComponent, { Transaction } from "../components/PaymentHistoryComponent";
import EditTransactionModal from "../components/EditTransactionModal";

const PaymentHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // Helper untuk mendapatkan tanggal hari ini dalam format YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // --- State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- Filter States ---
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(getTodayString());

  // --- Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // --- Helpers ---
  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    const tokenType = localStorage.getItem("token_type") ?? "Bearer";
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
    };
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token_type");
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleLogout = () => {
    handleUnauthorized();
  };

  // --- Data Fetching ---
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
          handleUnauthorized();
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
  }, [statusFilter, handleUnauthorized]);

  // --- Filter Client-Side ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (paymentFilter !== "all" && tx.payment_method !== paymentFilter) return false;
      
      if (dateFilter) {
        if (!tx.created_at) return false;
        const txDate = new Date(tx.created_at);
        const formattedTxDate = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}-${String(txDate.getDate()).padStart(2, "0")}`;
        if (formattedTxDate !== dateFilter) return false;
      }
      return true;
    });
  }, [transactions, paymentFilter, dateFilter]);

  // --- Label Indikator Ringkasan Filter Aktif ---
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

  // --- Handlers ---
  const handleEditClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const handleSaveEdit = async (id: string, updatedData: any) => {
    try {
      if (updatedData.items || updatedData.origins || updatedData.payment_method) {
        const responseEdit = await fetch(`/api/v1/transactions/${id}/edit`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            items: updatedData.items,
            origins: updatedData.origins,
            payment_method: updatedData.payment_method,
          }),
        });
        if (!responseEdit.ok) {
          if (responseEdit.status === 401) return handleUnauthorized();
          throw new Error("Gagal menyimpan rincian tiket.");
        }
      }

      if (updatedData.status) {
        const responseStatus = await fetch(`/api/v1/transactions/${id}/status`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: updatedData.status }),
        });
        if (!responseStatus.ok) {
          if (responseStatus.status === 401) return handleUnauthorized();
          throw new Error("Gagal menyimpan status tiket.");
        }
      }
      await loadTransactions();
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const response = await fetch(`/api/v1/transactions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 401) return handleUnauthorized();
      throw new Error("Gagal menghapus data.");
    }
    await loadTransactions();
  };

  const handleExportExcel = async () => {
    if (filteredTransactions.length === 0) return;
    try {
      setIsExporting(true);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Riwayat Transaksi");

      worksheet.columns = [
        { header: "No. Antrian", key: "queue_number", width: 15 },
        { header: "ID Transaksi", key: "id", width: 40 },
        { header: "Tanggal", key: "date", width: 20 },
        { header: "Waktu Konfirmasi", key: "time", width: 20 },
        { header: "Lantai yang Dipilih", key: "floors", width: 30 },
        { header: "Anak (Orang)", key: "child", width: 15 },
        { header: "Remaja (Orang)", key: "student", width: 18 },
        { header: "Dewasa (Orang)", key: "adult", width: 18 },
        { header: "Metode Pembayaran", key: "payment_method", width: 20 },
        { header: "Total Tagihan", key: "total_price", width: 25 },
        { header: "Status", key: "status", width: 15 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF000000" } };
      });

      const statusMap: Record<string, string> = {
        paid: "LUNAS", confirmed: "LUNAS", pending: "PENDING", cancelled: "BATAL",
      };

      filteredTransactions.forEach((tx) => {
        const dateObj = new Date(tx.created_at || "");
        const dateStr = `${dateObj.getDate().toString().padStart(2, "0")}/${(dateObj.getMonth() + 1).toString().padStart(2, "0")}/${dateObj.getFullYear()}`;

        let timeStr = "-";
        if (tx.confirmed_at) {
          const confDate = new Date(tx.confirmed_at);
          timeStr = `${confDate.getHours().toString().padStart(2, "0")}:${confDate.getMinutes().toString().padStart(2, "0")}`;
        } else {
          timeStr = "Menunggu";
        }

        const uniqueCounts = { adult: 0, student: 0, child: 0 };
        tx.items.forEach((item) => {
          const cat = item.age_category.toLowerCase();
          if (cat === "adult") uniqueCounts.adult = Math.max(uniqueCounts.adult, item.quantity);
          else if (cat === "student" || cat === "teen") uniqueCounts.student = Math.max(uniqueCounts.student, item.quantity);
          else if (cat === "child") uniqueCounts.child = Math.max(uniqueCounts.child, item.quantity);
        });

        const uniqueFloors = Array.from(new Set(tx.items.map((i) => i.floor))).sort().join(", ");
        let pmStr = "-";
        if (tx.payment_method === "card") pmStr = "EDC";
        else if (tx.payment_method === "qris") pmStr = "QRIS";
        else if (tx.payment_method) pmStr = tx.payment_method.toUpperCase();

        const row = worksheet.addRow({
          queue_number: tx.queue_number, id: tx.id, date: dateStr, time: timeStr, floors: uniqueFloors,
          child: uniqueCounts.child, student: uniqueCounts.student, adult: uniqueCounts.adult,
          payment_method: pmStr, total_price: tx.total_price, status: statusMap[tx.status] || tx.status,
        });
        row.getCell("total_price").numFmt = '"Rp"#,##0;[Red]\\-"Rp"#,##0';
      });

      const now = new Date();
      const dateSuffix = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now.getHours().toString().padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Data_Kasir_Sophilia_${dateSuffix}.xlsx`);
    } catch (err) {
      console.error("Failed to export to Excel:", err);
      alert("Terjadi kesalahan saat mengekspor data.");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // --- Navigasi ke Halaman Summary ---
  const handleViewSummary = () => {
    navigate("/admin/summary", { 
      state: { filteredTransactions, activeFilterLabel } 
    });
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col font-sans text-black">
      {/* HEADER */}
      <header className="bg-black border-b-[4px] border-[#fb9418] sticky top-0 z-40 shadow-md shrink-0">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <div className="flex flex-col select-none cursor-pointer" onClick={() => navigate("/admin")}>
            <h2 className="text-[#fcfcfc] font-light tracking-[0.3em] text-[10px] sm:text-xs uppercase ml-0.5">Galeria</h2>
            <h1 className="text-[#fb9418] font-bold tracking-wider text-xl sm:text-2xl uppercase leading-none mt-0.5">Sophilia</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:block text-xs font-bold tracking-widest uppercase bg-[#1a1a1a] text-[#fb9418] border border-zinc-800 px-3 py-1.5 rounded-lg shadow-inner">
              Riwayat Transaksi
            </div>
            <button
              onClick={() => navigate("/admin")}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg border border-zinc-700 text-gray-300 hover:text-[#fb9418] hover:border-[#fb9418] hover:bg-[#fb9418]/10 transition-all active:scale-95"
            >
              <span className="hidden sm:inline">Kembali ke Antrian</span>
              <span className="sm:hidden">Antrian</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-red-600/10 border border-red-500/30 text-red-500 hover:bg-red-600 hover:text-[#fcfcfc] transition-all active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b-2 border-gray-200 pb-5 gap-4 mt-2">
            <div>
              <h2 className="text-2xl font-bold text-black uppercase tracking-wider">Data Transaksi</h2>
              <p className="text-gray-500 text-sm mt-1">Pantau seluruh riwayat transaksi pengunjung.</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* FILTER TANGGAL */}
              <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-[#fb9418] focus-within:border-[#fb9418] cursor-pointer">
                <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <input
                  type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                  className="text-sm font-bold text-black outline-none bg-transparent cursor-pointer"
                  title="Filter Berdasarkan Tanggal"
                />
              </div>

              {/* FILTER STATUS */}
              <select
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border-gray-300 rounded-lg shadow-sm text-sm font-bold text-black focus:ring-[#fb9418] focus:border-[#fb9418] py-2 px-3 border outline-none cursor-pointer h-[38px]"
              >
                <option value="all">Semua Status</option>
                <option value="confirmed">Lunas / Dikonfirmasi</option>
                <option value="pending">Menunggu (Pending)</option>
                <option value="cancelled">Batal (Cancelled)</option>
              </select>

              {/* FILTER METODE */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white text-sm font-bold h-[38px]">
                {([ { value: "all", label: "Semua" }, { value: "qris", label: "QRIS" }, { value: "card", label: "EDC" } ] as const).map(({ value, label }) => (
                  <button
                    key={value} onClick={() => setPaymentFilter(value)}
                    className={`px-4 py-1 transition-colors focus:outline-none ${ paymentFilter === value ? value === "card" ? "bg-black text-white" : "bg-[#fb9418] text-white" : "text-gray-600 hover:bg-gray-50" } ${value !== "all" ? "border-l border-gray-300" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* TOMBOL HALAMAN SUMMARY (BARU) */}
              <button
                onClick={handleViewSummary}
                disabled={filteredTransactions.length === 0}
                className="text-sm font-bold px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 h-[38px]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                <span>Lihat Ringkasan</span>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExporting || filteredTransactions.length === 0}
                className="text-sm font-bold px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 h-[38px]"
              >
                {isExporting ? <span>Mengekspor...</span> : <span>Unduh Excel</span>}
              </button>
            </div>
          </header>

          {activeFilterLabel && (
            <div className="flex flex-wrap items-center gap-2 -mt-4">
              <span className="text-xs text-gray-500 font-medium">Filter aktif:</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-orange-50 text-[#fb9418] border border-orange-200">
                {activeFilterLabel}
                <span className="font-black text-black ml-1">{filteredTransactions.length} data</span>
              </span>
              <button
                onClick={() => { setStatusFilter("all"); setPaymentFilter("all"); setDateFilter(""); }}
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

          <PaymentHistoryComponent transactions={filteredTransactions} isLoading={isLoading} onEditClick={handleEditClick} />
        </div>
      </main>

      <EditTransactionModal
        isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} transaction={selectedTx}
        onSave={handleSaveEdit} onDelete={handleDeleteTransaction}
      />
    </div>
  );
};

export default PaymentHistoryPage;