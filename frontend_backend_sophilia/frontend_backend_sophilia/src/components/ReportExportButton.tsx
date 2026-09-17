/**
 * src/components/ReportExportButton.tsx
 * ----------------------------------------------------
 * Tombol unduh workbook laporan (Riwayat + Ringkasan + Negara) untuk satu
 * atau beberapa sesi. Dipakai di tab Riwayat & Ringkasan halaman detail
 * sesi (ekspor per sesi) dan di Laporan Gabungan (ekspor multi-sesi).
 *
 * Data diambil SAAT TOMBOL DITEKAN dari endpoint laporan backend
 * (`reportPath`), bukan dari state halaman:
 * - `/reports/sessions/{id}` — per sesi, ADMIN saja.
 * - `/reports/combined?date=&session_id=` — multi-sesi, ADMIN & KASIR.
 * Jadi hak akses ekspor ditegakkan API (403), bukan cuma disembunyikan di
 * UI. Nama berkas juga ditentukan backend (`file_name`). Halaman pemanggil
 * tetap hanya merender tombol untuk role yang berhak.
 */

import React, { useState } from "react";
import { apiGet, ApiError } from "../api/client";
import { SessionReport } from "../types";
import { computeReport, useMasterNameMap } from "../utils/report";
import { buildReportWorkbook } from "../utils/reportWorkbook";
import { downloadWorkbook } from "../utils/excel";

interface ReportExportButtonProps {
  /** Path endpoint laporan, mis. `/reports/sessions/<id>`. */
  reportPath: string;
  label: string;
  disabled?: boolean;
}

const ReportExportButton: React.FC<ReportExportButtonProps> = ({ reportPath, label, disabled = false }) => {
  const masterNameMap = useMasterNameMap();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const { sessions, transactions, file_name } = await apiGet<SessionReport>(reportPath);
      const report = computeReport(sessions, transactions, masterNameMap);
      const workbook = buildReportWorkbook({ sessions, transactions, report });
      await downloadWorkbook(workbook, file_name);
    } catch (err) {
      console.error("Gagal mengekspor laporan:", err);
      alert(err instanceof ApiError ? err.message : "Terjadi kesalahan saat mengekspor laporan ke Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting || disabled}
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
