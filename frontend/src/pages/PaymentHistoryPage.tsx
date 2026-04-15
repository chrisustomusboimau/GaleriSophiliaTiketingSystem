/**
 * PaymentHistoryPage.tsx
 * ----------------------------------------------------
 * Main page integrating the PaymentHistoryComponent.
 * Handles API calls, 401 redirects, state management, the Edit/Delete Modal,
 * Export to Excel functionality, and Data Summary.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import PaymentHistoryComponent, { Transaction } from "../components/PaymentHistoryComponent";
import EditTransactionModal from "../components/EditTransactionModal";
import Summary from "../components/Summary";

const PaymentHistoryPage: React.FC = () => {
  const navigate = useNavigate();

  // --- State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

      let url = "/api/v1/transactions";
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

  // --- Edit & Delete Handlers ---
  const handleEditClick = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  // ==========================================
  // FUNGSI UPDATE TIKET & STATUS (DIPERBARUI)
  // ==========================================
  const handleSaveEdit = async (id: string, updatedData: any) => {
    try {
      // 1. Update jumlah tiket terlebih dahulu
      const responseEdit = await fetch(`/api/v1/transactions/${id}/edit`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          under_8_count: updatedData.under_8_count,
          under_22_count: updatedData.under_22_count,
          adult_count: updatedData.adult_count
        }),
      });

      if (!responseEdit.ok) {
        if (responseEdit.status === 401) {
          handleUnauthorized();
          return;
        }
        throw new Error("Gagal menyimpan jumlah tiket.");
      }

      // 2. Update status pembayaran
      if (updatedData.status) {
        const responseStatus = await fetch(`/api/v1/transactions/${id}/status`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status: updatedData.status }),
        });

        if (!responseStatus.ok) {
          if (responseStatus.status === 401) {
            handleUnauthorized();
            return;
          }
          throw new Error("Gagal menyimpan status tiket.");
        }
      }

      // 3. Refresh data setelah sukses mengubah keduanya
      await loadTransactions();
      
    } catch (error) {
      console.error(error);
      throw error; // Melempar error agar ditangkap oleh blok try-catch di dalam Modal
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const response = await fetch(`/api/v1/transactions/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
      }
      throw new Error("Gagal menghapus data.");
    }

    await loadTransactions();
  };

  // ==========================================
  // DERIVED SUMMARY DATA
  // ==========================================
  const summaryStats = useMemo(() => {
    let totalChildren = 0;
    let totalTeens = 0;
    let totalAdults = 0;
    let totalRevenue = 0;

    transactions.forEach((tx) => {
      totalChildren += tx.under_8_count || 0;
      totalTeens += tx.under_22_count || 0;
      totalAdults += tx.adult_count || 0;
      totalRevenue += tx.total_price || 0; 
    });

    return {
      totalVisitors: totalChildren + totalTeens + totalAdults,
      totalChildren,
      totalTeens,
      totalAdults,
      totalRevenue,
    };
  }, [transactions]);

  // ==========================================
  // EXPORT TO EXCEL LOGIC
  // ==========================================
  const handleExportExcel = async () => {
    if (transactions.length === 0) return;
    
    try {
      setIsExporting(true);
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Riwayat Transaksi");

      worksheet.columns = [
        { header: "No. Antrian", key: "queue_number", width: 15 },
        { header: "ID Transaksi", key: "id", width: 40 },
        { header: "Tanggal", key: "date", width: 20 },
        { header: "Waktu", key: "time", width: 15 },
        { header: "Anak (< 8 thn)", key: "under_8", width: 18 },
        { header: "Remaja (< 22 thn)", key: "under_22", width: 20 },
        { header: "Dewasa (22+ thn)", key: "adult", width: 20 },
        { header: "Total Pembayaran", key: "total_price", width: 25 },
        { header: "Status", key: "status", width: 15 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
      });

      const statusMap: Record<string, string> = { 
        paid: "LUNAS", 
        pending: "PENDING", 
        cancelled: "BATAL" 
      };

      transactions.forEach((tx) => {
        const dateObj = new Date(tx.created_at);
        const dateStr = `${dateObj.getDate().toString().padStart(2, "0")}/${(dateObj.getMonth() + 1).toString().padStart(2, "0")}/${dateObj.getFullYear()}`;
        const timeStr = `${dateObj.getHours().toString().padStart(2, "0")}:${dateObj.getMinutes().toString().padStart(2, "0")}`;

        const row = worksheet.addRow({
          queue_number: tx.queue_number,
          id: tx.id,
          date: dateStr,
          time: timeStr,
          under_8: tx.under_8_count,
          under_22: tx.under_22_count,
          adult: tx.adult_count,
          total_price: tx.total_price,
          status: statusMap[tx.status] || tx.status,
        });

        row.getCell("total_price").numFmt = '"Rp"#,##0;[Red]\-"Rp"#,##0';
      });

      const now = new Date();
      const dateSuffix = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const fileName = `Report_Transaksi_${dateSuffix}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, fileName);

    } catch (err) {
      console.error("Failed to export to Excel:", err);
      alert("Terjadi kesalahan saat mengekspor data.");
    } finally {
      setIsExporting(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Museum Ticketing</h1>
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium bg-blue-100 text-blue-800 px-3 py-1 rounded-full hidden sm:block">
              Riwayat Transaksi
            </div>
            <button
              onClick={() => navigate("/admin")} 
              className="text-sm font-medium px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Kembali ke Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-medium px-3 py-1 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-gray-200 pb-4 gap-4 mt-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Riwayat Pembayaran</h2>
              <p className="text-gray-600">Pantau seluruh transaksi yang telah masuk.</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500 py-2 px-3 border outline-none bg-white"
              >
                <option value="all">Semua Status</option>
                <option value="paid">Lunas (Paid)</option>
                <option value="pending">Menunggu (Pending)</option>
                <option value="cancelled">Batal (Cancelled)</option>
              </select>

              <button
                onClick={loadTransactions}
                disabled={isLoading}
                className="text-sm font-medium px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isLoading ? "Memuat..." : "Segarkan"}
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExporting || transactions.length === 0}
                className="text-sm font-medium px-4 py-2 bg-green-600 border border-green-600 rounded-md text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
              >
                {isExporting ? (
                  <span>Mengekspor...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    Export Excel
                  </>
                )}
              </button>
            </div>
          </header>

          <Summary 
            totalVisitors={summaryStats.totalVisitors}
            totalChildren={summaryStats.totalChildren}
            totalTeens={summaryStats.totalTeens}
            totalAdults={summaryStats.totalAdults}
            totalRevenue={summaryStats.totalRevenue}
          />

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md shadow-sm">
              <p>{error}</p>
            </div>
          )}

          <PaymentHistoryComponent 
            transactions={transactions} 
            isLoading={isLoading} 
            onEditClick={handleEditClick} 
          />
        </div>
      </main>

      <EditTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTx}
        onSave={handleSaveEdit}
        onDelete={handleDeleteTransaction} 
      />
    </div>
  );
};

export default PaymentHistoryPage;