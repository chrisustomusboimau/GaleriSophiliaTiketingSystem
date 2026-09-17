/**
 * src/utils/reportWorkbook.ts
 * ----------------------------------------------------
 * Satu workbook Excel untuk laporan sesi — dipakai ekspor PER SESI maupun
 * MULTI-SESI (Laporan Gabungan). Enam sheet:
 *   1. Riwayat Transaksi   4. Audit Tiket
 *   2. Statistik           5. Kepadatan Pengunjung
 *   3. Rekap Penjualan     6. Negara
 *
 * Semua angka ringkasan diambil dari `ReportData` (hasil `computeReport`),
 * objek yang SAMA dengan yang dirender di layar Ringkasan. Tidak ada
 * perhitungan kedua di sini: kalau ada, cepat atau lambat angka di berkas
 * unduhan akan berbeda dari angka di layar.
 */

import ExcelJS from "exceljs";
import { OperationalSession, TransactionEntry } from "../types";
import { formatDateID, getStaffNameFromEmail, PAYMENT_METHOD_LABEL, TRANSACTION_STATUS_LABEL } from "./formatters";
import { CURRENCY_NUM_FMT, styleHeaderRow } from "./excel";
import { countryName, PAYMENT_METHODS, ReportData } from "./report";

interface BuildReportWorkbookArgs {
  sessions: OperationalSession[];
  /** Seluruh transaksi milik sesi-sesi di atas (semua status). */
  transactions: TransactionEntry[];
  report: ReportData;
}

export function buildReportWorkbook({ sessions, transactions, report }: BuildReportWorkbookArgs): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const multi = sessions.length > 1;
  const sessionNameById = new Map(sessions.map((s) => [s.id, s.name]));
  const dates = Array.from(new Set(sessions.map((s) => formatDateID(s.date)))).join(", ");
  const periode = `${dates} ${report.windowsLabel}`;

  // --- Sheet 1: Riwayat Transaksi ---
  const historySheet = workbook.addWorksheet("Riwayat Transaksi");
  historySheet.columns = [
    { header: "Kode Tiket", key: "ticket_code", width: 18 },
    { header: "No. Antrian", key: "queue_number", width: 15 },
    // Kolom sesi hanya perlu kalau transaksinya berasal dari beberapa sesi.
    ...(multi ? [{ header: "Sesi", key: "session_name", width: 20 }] : []),
    { header: "ID Transaksi", key: "id", width: 40 },
    { header: "Nama Pemesan", key: "customer_name", width: 25 },
    { header: "Tanggal", key: "date", width: 20 },
    { header: "Waktu Konfirmasi", key: "time", width: 20 },
    { header: "Rincian Tiket", key: "items_summary", width: 45 },
    { header: "Metode Pembayaran", key: "payment_method", width: 20 },
    // Kolom terpisah, bukan digabung ke kolom di atas: rekonsiliasi
    // dibaca dua arah — total per kategori untuk buku besar, total per
    // alat untuk mencocokkan struk EDC.
    { header: "Metode Pembayaran Detail", key: "payment_method_detail", width: 26 },
    { header: "Total Tagihan", key: "total_price", width: 25 },
    { header: "Status", key: "status", width: 15 },
    { header: "Dikonfirmasi Oleh", key: "confirmed_by", width: 24 },
  ];
  styleHeaderRow(historySheet);

  transactions.forEach((tx) => {
    const dateObj = new Date(tx.created_at || "");
    const dateStr = `${dateObj.getDate().toString().padStart(2, "0")}/${(dateObj.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${dateObj.getFullYear()}`;

    let timeStr = "Menunggu";
    if (tx.confirmed_at) {
      const confDate = new Date(tx.confirmed_at);
      timeStr = `${confDate.getHours().toString().padStart(2, "0")}:${confDate.getMinutes().toString().padStart(2, "0")}`;
    }

    const row = historySheet.addRow({
      ticket_code: tx.ticket_code,
      queue_number: tx.queue_number,
      session_name: sessionNameById.get(tx.session_id) || "-",
      id: tx.id,
      customer_name: tx.customer_name,
      date: dateStr,
      time: timeStr,
      items_summary: tx.items.map((i) => `${i.quantity}x ${i.ticket_name_snapshot}`).join("; "),
      payment_method: PAYMENT_METHOD_LABEL[tx.payment_method] || tx.payment_method?.toUpperCase() || "-",
      payment_method_detail: tx.payment_method_detail || "-",
      total_price: tx.total_price,
      status: TRANSACTION_STATUS_LABEL[tx.status] || tx.status,
      confirmed_by: getStaffNameFromEmail(tx.confirmed_by_email),
    });
    row.getCell("total_price").numFmt = CURRENCY_NUM_FMT;
  });

  // --- Sheet 2: Statistik ---
  const { dynamicStats, variantNames, salesSummary, auditRows, auditTotals, groupNames, timeIntervalStats } = report;
  const statSheet = workbook.addWorksheet("Statistik");
  statSheet.columns = [
    { header: "Keterangan", key: "label", width: 34 },
    { header: "Nilai", key: "value", width: 24 },
  ];
  styleHeaderRow(statSheet);
  statSheet.addRow({ label: "Nama Sesi", value: sessions.map((s) => s.name).join(", ") });
  statSheet.addRow({ label: "Periode", value: periode });
  statSheet.addRow({ label: "Total Orang", value: dynamicStats.visitors });
  variantNames.forEach((name) => {
    statSheet.addRow({ label: `Jumlah — ${name}`, value: dynamicStats.byVariant[name] });
  });
  const revenueRow = statSheet.addRow({ label: "Total Tagihan", value: dynamicStats.revenue });
  revenueRow.getCell("value").numFmt = CURRENCY_NUM_FMT;

  // --- Sheet 3: Rekap Penjualan (varian x metode pembayaran) ---
  const salesSheet = workbook.addWorksheet("Rekap Penjualan");
  salesSheet.columns = [
    { header: "Jenis Tiket", key: "label", width: 38 },
    { header: "Harga", key: "price", width: 16 },
    ...PAYMENT_METHODS.flatMap((m) => [
      { header: `${PAYMENT_METHOD_LABEL[m]} — Qty`, key: `${m}_qty`, width: 14 },
      { header: `${PAYMENT_METHOD_LABEL[m]} — Rp`, key: `${m}_amount`, width: 18 },
    ]),
    { header: "Grand Total — Qty", key: "total_qty", width: 18 },
    { header: "Grand Total — Rp", key: "total_amount", width: 20 },
  ];
  styleHeaderRow(salesSheet);
  salesSummary.rows.forEach((row) => {
    const rowQty = PAYMENT_METHODS.reduce((sum, m) => sum + row.byMethod[m].qty, 0);
    const rowAmount = PAYMENT_METHODS.reduce((sum, m) => sum + row.byMethod[m].nominal, 0);
    const added = salesSheet.addRow({
      label: row.label,
      price: row.price,
      ...Object.fromEntries(
        PAYMENT_METHODS.flatMap((m) => [
          [`${m}_qty`, row.byMethod[m].qty],
          [`${m}_amount`, row.byMethod[m].nominal],
        ])
      ),
      total_qty: rowQty,
      total_amount: rowAmount,
    });
    ["price", ...PAYMENT_METHODS.map((m) => `${m}_amount`), "total_amount"].forEach((key) => {
      added.getCell(key).numFmt = CURRENCY_NUM_FMT;
    });
  });
  const totalRow = salesSheet.addRow({
    label: "TOTAL KESELURUHAN",
    ...Object.fromEntries(
      PAYMENT_METHODS.flatMap((m) => [
        [`${m}_qty`, salesSummary.totalsByMethod[m].qty],
        [`${m}_amount`, salesSummary.totalsByMethod[m].nominal],
      ])
    ),
    total_qty: salesSummary.grandTotalQty,
    total_amount: salesSummary.grandTotalNominal,
  });
  totalRow.font = { bold: true };
  [...PAYMENT_METHODS.map((m) => `${m}_amount`), "total_amount"].forEach((key) => {
    totalRow.getCell(key).numFmt = CURRENCY_NUM_FMT;
  });

  // --- Sheet 4: Audit Tiket (fisik vs digital) ---
  const auditSheet = workbook.addWorksheet("Audit Tiket");
  auditSheet.columns = [
    { header: "Varian Tiket", key: "label", width: 38 },
    { header: "No. Awal", key: "start", width: 14 },
    { header: "No. Akhir", key: "end", width: 14 },
    { header: "Fisik Terpakai", key: "physical", width: 16 },
    { header: "Terjual Digital", key: "digital", width: 16 },
    { header: "Selisih", key: "diff", width: 12 },
  ];
  styleHeaderRow(auditSheet);
  auditRows.forEach((r) => {
    auditSheet.addRow({
      label: r.label,
      start: r.start ?? "-",
      end: r.end ?? "-",
      physical: r.physicalUsed ?? "-",
      digital: r.digitalSold,
      diff: r.selisih ?? "-",
    });
  });
  if (auditRows.length > 0) {
    const auditTotalRow = auditSheet.addRow({
      label: "TOTAL",
      physical: auditTotals.physical,
      digital: auditTotals.digital,
      diff: auditTotals.selisih,
    });
    auditTotalRow.font = { bold: true };
  }

  // --- Sheet 5: Kepadatan Pengunjung (kolom dinamis per master) ---
  const densitySheet = workbook.addWorksheet("Kepadatan Pengunjung");
  densitySheet.columns = [
    { header: "Rentang Waktu", key: "label", width: 20 },
    ...groupNames.map((g) => ({ header: g, key: `g_${g}`, width: 20 })),
    { header: "Total", key: "total", width: 12 },
  ];
  styleHeaderRow(densitySheet);
  timeIntervalStats.forEach((interval) => {
    densitySheet.addRow({
      label: interval.label,
      ...Object.fromEntries(groupNames.map((g) => [`g_${g}`, interval.byGroup[g] || 0])),
      total: interval.total,
    });
  });

  // --- Sheet 6: Negara (statistik pengunjung per negara) ---
  const countrySheet = workbook.addWorksheet("Negara");
  countrySheet.columns = [
    { header: "Negara", key: "country", width: 30 },
    { header: "Jumlah Pengunjung", key: "count", width: 20 },
  ];
  styleHeaderRow(countrySheet);
  report.countryStats.forEach(([code, count]) => {
    countrySheet.addRow({ country: countryName(code), count });
  });

  return workbook;
}
