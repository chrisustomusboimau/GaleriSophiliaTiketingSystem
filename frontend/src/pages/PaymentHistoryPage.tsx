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
  const [statusFilter, setStatusFilter] = useState<string>("paid");

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

  const handleSaveEdit = async (id: string, updatedData: any) => {
    try {
      if (updatedData.items) {
        const responseEdit = await fetch(`/api/v1/transactions/${id}/edit`, {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({ items: updatedData.items }),
        });

        if (!responseEdit.ok) {
          if (responseEdit.status === 401) {
            handleUnauthorized();
            return;
          }
          throw new Error("Gagal menyimpan jumlah tiket.");
        }
      }

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
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Unauthorized");
      }
      throw new Error("Gagal menghapus data.");
    }

    await loadTransactions();
  };

  // ==========================================
  // DERIVED SUMMARY DATA (UNIQUE PEOPLE COUNT)
  // ==========================================
  const summaryStats = useMemo(() => {
    let totalChildren = 0;
    let totalTeens = 0;
    let totalAdults = 0;
    let totalRevenue = 0;

    transactions.forEach((tx) => {
      totalRevenue += tx.total_price || 0; 
      
      const seenCategories = new Set<string>();

      tx.items.forEach(item => {
        const cat = item.age_category.toLowerCase();
        if (!seenCategories.has(cat)) {
          if (cat === 'child') totalChildren += item.quantity;
          else if (cat === 'student' || cat === 'teen') totalTeens += item.quantity;
          else if (cat === 'adult') totalAdults += item.quantity;
          seenCategories.add(cat);
        }
      });
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
        { header: "Lantai yang Dipilih", key: "floors", width: 30 },
        { header: "Anak (Orang)", key: "child", width: 15 },
        { header: "Remaja (Orang)", key: "student", width: 18 },
        { header: "Dewasa (Orang)", key: "adult", width: 18 },
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

        const uniqueCounts = { adult: 0, student: 0, child: 0 };
        const seenCategories = new Set<string>();
        
        tx.items.forEach(item => {
          const cat = item.age_category.toLowerCase();
          if (!seenCategories.has(cat)) {
            if (cat === 'adult') uniqueCounts.adult = item.quantity;
            if (cat === 'student' || cat === 'teen') uniqueCounts.student = item.quantity;
            if (cat === 'child') uniqueCounts.child = item.quantity;
            seenCategories.add(cat);
          }
        });

        const uniqueFloors = Array.from(new Set(tx.items.map(i => i.floor))).sort().join(", ");

        const row = worksheet.addRow({
          queue_number: tx.queue_number,
          id: tx.id,
          date: dateStr,
          time: timeStr,
          floors: uniqueFloors,
          child: uniqueCounts.child,
          student: uniqueCounts.student,
          adult: uniqueCounts.adult,
          total_price: tx.total_price,
          status: statusMap[tx.status] || tx.status,
        });

        row.getCell("total_price").numFmt = '"Rp"#,##0;[Red]\-"Rp"#,##0';
      });

      const now = new Date();
      const dateSuffix = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Report_Transaksi_${dateSuffix}.xlsx`);

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
      {/* Header ... */}
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
          {/* Controls Header ... */}
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
                {isExporting ? <span>Mengekspor...</span> : <span>Export Excel</span>}
              </button>
            </div>
          </header>

          {/* SUMMARY DENGAN PROP TRANSACTIONS */}
          <Summary 
            totalVisitors={summaryStats.totalVisitors}
            totalChildren={summaryStats.totalChildren}
            totalTeens={summaryStats.totalTeens}
            totalAdults={summaryStats.totalAdults}
            totalRevenue={summaryStats.totalRevenue}
            transactions={transactions} 
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