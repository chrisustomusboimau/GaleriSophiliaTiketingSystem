/**
 * src/components/Summary.tsx
 * ----------------------------------------------------
 * Ringkasan SATU ATAU BEBERAPA sesi operasional. Ditulis ulang total dari versi lama:
 * - Tidak ada lagi `TICKET_CATEGORIES` harga hardcoded per lantai — semua
 *   varian, harga, dan pengelompokan "lantai" diambil dari Master Data
 *   sungguhan (`session.active_tickets` + `GET /ticket-masters` untuk nama
 *   master), jadi otomatis menyesuaikan berapa pun jumlah master/varian
 *   yang dikonfigurasi admin.
 * - Statistik per kategori usia (dulu Dewasa/Remaja/Anak tetap) sekarang
 *   dinamis: satu kartu per nama varian yang benar-benar ada di sesi ini.
 * - Rekap pembayaran mendukung 3 metode (QRIS/Kartu/Tunai), bukan cuma 2.
 * - BARU: bagian "Audit Tiket" digabung langsung di sini (tiket fisik
 *   terpakai vs terjual digital per varian) — tidak lagi jadi laporan
 *   terpisah, sesuai permintaan agar tidak terpisah dari ringkasan sesi.
 * - UPDATE: seluruh kontrol filter (status & rentang waktu) DIHAPUS TOTAL.
 *   Ringkasan sekarang auto-load: selalu status Lunas/Dikonfirmasi, selalu
 *   dalam jam sesi (session.start_time–end_time), tanpa perlu interaksi
 *   apa pun dari user.
 *
 * UPDATE v2:
 * - Kepadatan pengunjung dipecah per 15 MENIT (dulu 30).
 * - Penghitungan "orang" di-dedupe per VARIAN USIA (age_category_id) —
 *   lihat `dedupeKeyFor` di `src/utils/report.ts`.
 *
 * UPDATE v3 — LAPORAN GABUNGAN:
 * - Menerima `sessions` (array). Per sesi = array berisi satu sesi; Laporan
 *   Gabungan mengirim beberapa sesi dalam satu tanggal, dan layout di bawah
 *   dipakai apa adanya untuk keduanya.
 * - Seluruh perhitungan pindah ke `computeReport` (`src/utils/report.ts`)
 *   supaya ekspor Excel (`ReportExportButton`) memakai angka yang persis
 *   sama dengan yang tampil di layar.
 * - Tombol ekspor tidak lagi dimiliki komponen ini: pemanggil mengirim
 *   `exportSlot` sesuai hak akses role-nya (atau tidak sama sekali).
 */

import React, { useMemo } from "react";
import { OperationalSession, TransactionEntry } from "../types";
import { formatCurrency, PAYMENT_METHOD_LABEL } from "../utils/formatters";
import { computeReport, countryName, DENSITY_INTERVAL_MINUTES, PAYMENT_METHODS, useMasterNameMap } from "../utils/report";

interface SummaryProps {
  sessions: OperationalSession[];
  /** Seluruh transaksi milik sesi-sesi ini (semua status) — Summary yang menyaring sendiri. */
  transactions: TransactionEntry[];
  /** Tombol ekspor dari pemanggil; kosong = tidak ada tombol (mis. role tanpa hak ekspor). */
  exportSlot?: React.ReactNode;
}

const Summary: React.FC<SummaryProps> = ({ sessions, transactions, exportSlot }) => {
  const masterNameMap = useMasterNameMap();
  const isCombined = sessions.length > 1;

  const report = useMemo(
    () => computeReport(sessions, transactions, masterNameMap),
    [sessions, transactions, masterNameMap]
  );
  const {
    windowsLabel,
    dynamicStats,
    variantNames,
    groupStats,
    countryStats,
    salesSummary,
    groupNames,
    timeIntervalStats,
    auditRows,
    auditTotals,
    visitorMatrix,
  } = report;

  // --- MATRIKS PENGUNJUNG — judul dinamis ---
  const matrixTitle = isCombined
    ? "Rangkuman Pengunjung Keseluruhan (Laporan Gabungan)"
    : `Rangkuman Pengunjung - Sesi ${sessions[0]?.name ?? "-"}`;

  return (
    <div className="space-y-6">
      {/* JUDUL + EKSPOR */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">{isCombined ? "Ringkasan Gabungan" : "Ringkasan Sesi"}</h3>
          <p className="text-gray-500 text-sm mt-0.5">{sessions.map((s) => s.name).join(", ")}</p>
        </div>
        {exportSlot}
      </div>

      {/* INFO AUTO-LOAD */}
      <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3">
        <svg className="w-5 h-5 text-[#fb9418] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs sm:text-sm text-gray-600 font-medium">
          Menampilkan transaksi <span className="font-bold text-black">Lunas/Dikonfirmasi</span> selama jam sesi{" "}
          <span className="font-bold text-black">{windowsLabel}</span>
          . Bagian Audit Tiket di bawah selalu memakai seluruh transaksi sesi (tidak dibatasi jendela waktu ini).
          {exportSlot && (
            <>
              {" "}Tombol <span className="font-bold text-black">Download Excel</span> mengekspor angka yang persis sama
              dengan yang tampil di halaman ini.
            </>
          )}
        </p>
      </div>

      {/* KARTU STATISTIK */}
      <div className="flex flex-wrap gap-4">
        <div className="bg-black p-5 rounded-2xl shadow-md border border-gray-800 flex flex-col justify-center items-center text-center flex-1 min-w-[140px]">
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Orang</span>
          <span className="text-4xl font-black text-[#fb9418]">{dynamicStats.visitors}</span>
        </div>

        {variantNames.map((name) => (
          <div key={name} className="bg-[#fcfcfc] p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center items-center text-center flex-1 min-w-[140px]">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">{name}</span>
            <span className="text-3xl font-black text-black">{dynamicStats.byVariant[name]}</span>
          </div>
        ))}

        <div className="bg-orange-50 p-5 rounded-2xl shadow-sm border border-[#fb9418]/30 flex flex-col justify-center items-center text-center flex-1 min-w-[160px]">
          <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1">Total Tagihan</span>
          <span className="text-2xl font-black text-[#fb9418]">{formatCurrency(dynamicStats.revenue)}</span>
        </div>
      </div>

      {/* MATRIKS PENGUNJUNG — kategori umur x kombinasi jenis tiket */}
      <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-white">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">{matrixTitle}</h4>
          <p className="text-xs text-gray-600 mt-1 font-medium">
            Jumlah pengunjung per kategori umur, disilangkan dengan setiap kemungkinan kombinasi jenis tiket.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-black text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest">
                <th className="p-3 text-white">Ticket / Kategori Umur</th>
                {visitorMatrix.columnLabels.map((c) => (
                  <th key={c} className="p-3 text-center border-l border-zinc-800 whitespace-nowrap text-white">
                    {c}
                  </th>
                ))}
                <th className="p-3 text-center border-l border-zinc-800 text-[#fb9418] font-extrabold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm bg-white">
              {visitorMatrix.rows.map((row) => (
                <tr key={row.label} className="hover:bg-orange-50/50 transition-colors">
                  <td className="p-3 font-bold text-black whitespace-nowrap">{row.label}</td>
                  {visitorMatrix.columnLabels.map((c) => (
                    <td
                      key={c}
                      className={`p-3 text-center border-l border-gray-200 ${
                        row.counts[c] ? "text-black font-extrabold" : "text-gray-500 font-medium"
                      }`}
                    >
                      {row.counts[c] || 0}
                    </td>
                  ))}
                  <td className="p-3 text-center border-l border-gray-200 font-black text-black bg-orange-100/60">
                    {row.total}
                  </td>
                </tr>
              ))}
              {visitorMatrix.rows.length === 0 && (
                <tr>
                  <td colSpan={visitorMatrix.columnLabels.length + 2} className="p-6 text-center text-gray-600 italic font-medium">
                    Belum ada data pengunjung pada filter ini.
                  </td>
                </tr>
              )}
            </tbody>
            {visitorMatrix.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-100 font-black text-black">
                  <td className="p-3 text-black">Total</td>
                  {visitorMatrix.columnLabels.map((c) => (
                    <td key={c} className="p-3 text-center border-l border-gray-300 text-black">
                      {visitorMatrix.columnTotals[c] || 0}
                    </td>
                  ))}
                  <td className="p-3 text-center border-l border-gray-300 text-black bg-orange-200/80 font-black">
                    {visitorMatrix.grandTotal}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* AUDIT TIKET — fisik vs digital */}
      <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-white">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">Audit Tiket — Fisik vs Digital</h4>
          <p className="text-xs text-gray-500 mt-1">Perbandingan nomor tiket fisik terpakai dengan penjualan tercatat di sistem.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
                <th className="px-4 py-3">Varian Tiket</th>
                <th className="px-4 py-3 text-right">No. Awal</th>
                <th className="px-4 py-3 text-right">No. Akhir</th>
                <th className="px-4 py-3 text-right">Fisik Terpakai</th>
                <th className="px-4 py-3 text-right">Terjual Digital</th>
                <th className="px-4 py-3 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-bold text-black">{r.label}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{r.start ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{r.end ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-bold text-black">{r.physicalUsed ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-bold text-black">{r.digitalSold}</td>
                  <td className="px-4 py-3 text-right">
                    {r.selisih === null ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      <span className={`font-black px-2 py-0.5 rounded ${r.selisih === 0 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                        {r.selisih > 0 ? `+${r.selisih}` : r.selisih}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {auditRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic">
                    Sesi ini tidak memiliki tiket aktif.
                  </td>
                </tr>
              )}
            </tbody>
            {auditRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-black">
                  <td className="px-4 py-3 text-black">TOTAL</td>
                  <td />
                  <td />
                  <td className="px-4 py-3 text-right text-black">{auditTotals.physical}</td>
                  <td className="px-4 py-3 text-right text-black">{auditTotals.digital}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={auditTotals.selisih === 0 ? "text-green-700" : "text-red-700"}>
                      {auditTotals.selisih > 0 ? `+${auditTotals.selisih}` : auditTotals.selisih}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* REKAP PENJUALAN PER VARIAN x METODE PEMBAYARAN */}
      <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-white">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">Rekapitulasi Penjualan (Sesuai Filter)</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-black text-[#fcfcfc] text-[10px] sm:text-xs font-bold uppercase tracking-widest border-b border-zinc-800">
                <th className="p-3 align-middle" rowSpan={2}>Jenis Tiket</th>
                <th className="p-3 align-middle border-r border-zinc-800 text-center" rowSpan={2}>Harga</th>
                {PAYMENT_METHODS.map((m) => (
                  <th key={m} className="p-3 text-center border-r border-zinc-800" colSpan={2}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </th>
                ))}
                <th className="p-3 text-center" colSpan={2}>GRAND TOTAL</th>
              </tr>
              <tr className="bg-zinc-900 text-gray-300 text-[10px] font-bold uppercase tracking-widest border-b-2 border-[#fb9418]">
                {PAYMENT_METHODS.map((m) => (
                  <React.Fragment key={m}>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-center border-r border-zinc-700">Rp</th>
                  </React.Fragment>
                ))}
                <th className="p-2 text-center text-[#fb9418]">Qty</th>
                <th className="p-2 text-center text-[#fb9418]">Rp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs sm:text-sm bg-white">
              {salesSummary.rows.map((row) => {
                const rowGtQty = PAYMENT_METHODS.reduce((s, m) => s + row.byMethod[m].qty, 0);
                const rowGtNominal = PAYMENT_METHODS.reduce((s, m) => s + row.byMethod[m].nominal, 0);
                return (
                  <tr key={row.subCategoryId} className="hover:bg-orange-50/40 transition-colors">
                    <td className="p-3 font-bold text-gray-800 whitespace-nowrap">{row.label}</td>
                    <td className="p-3 text-center font-mono text-gray-500 border-r border-gray-100 whitespace-nowrap">{formatCurrency(row.price)}</td>
                    {PAYMENT_METHODS.map((m) => (
                      <React.Fragment key={m}>
                        <td className={`p-3 text-center font-bold ${row.byMethod[m].qty > 0 ? "text-black" : "text-gray-300"}`}>{row.byMethod[m].qty}</td>
                        <td className={`p-3 text-right font-mono border-r border-gray-100 ${row.byMethod[m].nominal > 0 ? "text-green-700" : "text-gray-300"}`}>
                          {row.byMethod[m].nominal > 0 ? formatCurrency(row.byMethod[m].nominal) : "-"}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className={`p-3 text-center font-black ${rowGtQty > 0 ? "text-black bg-orange-50/50" : "text-gray-300"}`}>{rowGtQty}</td>
                    <td className={`p-3 text-right font-bold font-mono ${rowGtNominal > 0 ? "text-[#fb9418] bg-orange-50/50" : "text-gray-300"}`}>
                      {rowGtNominal > 0 ? formatCurrency(rowGtNominal) : "-"}
                    </td>
                  </tr>
                );
              })}
              {salesSummary.rows.length === 0 && (
                <tr>
                  <td colSpan={2 + PAYMENT_METHODS.length * 2 + 2} className="p-6 text-center text-gray-400 italic">
                    Sesi ini tidak memiliki tiket aktif.
                  </td>
                </tr>
              )}
            </tbody>
            {salesSummary.rows.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 text-xs sm:text-sm font-black">
                <tr>
                  <td className="p-3 text-right uppercase tracking-wider text-black" colSpan={2}>
                    Total Keseluruhan:
                  </td>
                  {PAYMENT_METHODS.map((m) => (
                    <React.Fragment key={m}>
                      <td className="p-3 text-center text-black">{salesSummary.totalsByMethod[m].qty}</td>
                      <td className="p-3 text-right text-green-700 font-mono border-r border-gray-200">{formatCurrency(salesSummary.totalsByMethod[m].nominal)}</td>
                    </React.Fragment>
                  ))}
                  <td className="p-3 text-center text-black bg-orange-100/50">{salesSummary.grandTotalQty}</td>
                  <td className="p-3 text-right text-[#fb9418] text-base font-mono bg-orange-100/50">{formatCurrency(salesSummary.grandTotalNominal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* KEPADATAN PENGUNJUNG PER 15 MENIT */}
      <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-white">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">
            Kepadatan Pengunjung (Per {DENSITY_INTERVAL_MINUTES} Menit)
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-widest border-b-2 border-gray-200">
                <th className="p-3">Rentang Waktu</th>
                {groupNames.map((g) => (
                  <th key={g} className="p-3 text-center border-l border-gray-200">
                    {g}
                  </th>
                ))}
                <th className="p-3 text-center border-l border-gray-300 text-black">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm bg-white font-medium text-gray-700">
              {timeIntervalStats.length > 0 ? (
                timeIntervalStats.map((interval, idx) => (
                  <tr key={idx} className="hover:bg-orange-50/50 transition-colors">
                    <td className="p-3 font-bold text-gray-800">{interval.label}</td>
                    {groupNames.map((g) => (
                      <td key={g} className={`p-3 text-center border-l border-gray-100 ${interval.byGroup[g] > 0 ? "text-black font-bold" : "text-gray-300"}`}>
                        {interval.byGroup[g] || 0}
                      </td>
                    ))}
                    <td className={`p-3 text-center border-l border-gray-200 font-black ${interval.total > 0 ? "text-[#fb9418]" : "text-gray-300"}`}>{interval.total}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={groupNames.length + 2} className="p-6 text-center text-gray-400 italic">
                    Rentang waktu tidak valid atau kosong.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KUNJUNGAN PER MASTER & DISTRIBUSI NEGARA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#fcfcfc] p-6 rounded-2xl shadow-sm border border-gray-200">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider mb-5 border-b-2 border-gray-100 pb-3">Kunjungan Per Master Tiket</h4>
          <div className="flex flex-col gap-3">
            {groupStats.length > 0 ? (
              groupStats.map(([group, count]) => (
                <div key={group} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm w-full">
                  <span className="text-sm font-bold text-gray-700 uppercase">{group}</span>
                  <span className="text-xl font-black text-black">
                    {count} <small className="text-[10px] font-bold text-[#fb9418] uppercase tracking-widest ml-1">Orang</small>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg">Belum ada data pada filter ini.</p>
            )}
          </div>
        </div>

        <div className="bg-[#fcfcfc] p-6 rounded-2xl shadow-sm border border-gray-200">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider mb-5 border-b-2 border-gray-100 pb-3">Distribusi Negara</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {countryStats.length > 0 ? (
              countryStats.map(([country, count]) => (
                <div key={country} className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <span className="text-2xl font-black text-black leading-none mb-1">{count}</span>
                  <span className="text-xs font-bold text-[#fb9418] uppercase tracking-widest" title={countryName(country)}>{country}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-400 italic text-sm col-span-full text-center py-4 bg-gray-50 rounded-lg">Belum ada data pada filter ini.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Summary;