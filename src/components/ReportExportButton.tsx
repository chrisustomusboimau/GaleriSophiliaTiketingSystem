/**
 * src/components/ReportExportButton.tsx
 * ----------------------------------------------------
 * Tombol unduh workbook laporan (Riwayat + Ringkasan + Negara) untuk satu
 * atau beberapa sesi. Dipakai di tab Riwayat & Ringkasan halaman detail
 * sesi (ekspor per sesi) dan di Laporan Gabungan (ekspor multi-sesi).
 *
 * Ekspor sepenuhnya CLIENT-SIDE: workbook dibangun di browser dari sesi &
 * transaksi yang SUDAH di-fetch halaman pemanggil (`/transactions/all`),
 * tanpa request tambahan ke backend.
 *
 * Komponen ini TIDAK memeriksa role — halaman pemanggil yang memutuskan
 * apakah tombol dirender (per sesi: admin saja; multi-sesi: admin & kasir).
 */

import React, { useState } from "react";
import { OperationalSession, TransactionEntry } from "../types";
import { computeReport, useMasterNameMap } from "../utils/report";
import { buildReportWorkbook } from "../utils/reportWorkbook";
import { downloadWorkbook } from "../utils/excel";

interface ReportExportButtonProps {
  sessions: OperationalSession[];
  /** Seluruh transaksi milik sesi-sesi di atas (semua status). */
  transactions: TransactionEntry[];
  fileName: string;
  label: string;
}

const ReportExportButton: React.FC<ReportExportButtonProps> = ({ sessions, transactions, fileName, label }) => {
  const masterNameMap = useMasterNameMap();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const report = computeReport(sessions, transactions, masterNameMap);
      const workbook = buildReportWorkbook({ sessions, transactions, report });
      await downloadWorkbook(workbook, fileName);
    } catch (err) {
      console.error("Gagal mengekspor laporan:", err);
      alert("Terjadi kesalahan saat mengekspor laporan ke Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || sessions.length === 0}
      className="text-sm font-bold px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-lg text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2 h-[38px] self-start sm:self-auto"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {isExporting ? "Mengekspor..." : label}
    </button>
  );
};

export default ReportExportButton;
