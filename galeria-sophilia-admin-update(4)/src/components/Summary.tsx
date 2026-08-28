/**
 * src/components/Summary.tsx
 * ----------------------------------------------------
 * Ringkasan SATU sesi operasional. Ditulis ulang total dari versi lama:
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
 * - Filter preset waktu lama (Minggu Pagi/Siang, Sabtu) dihapus karena
 *   tidak relevan lagi — sesi sekarang punya jam mulai/selesai sungguhan.
 * - UPDATE: seluruh kontrol filter (status & rentang waktu) DIHAPUS TOTAL.
 *   Ringkasan sekarang auto-load: selalu status Lunas/Dikonfirmasi, selalu
 *   dalam jam sesi (session.start_time–end_time), tanpa perlu interaksi
 *   apa pun dari user.
 */

import React, { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import { OperationalSession, TicketMaster, TransactionEntry } from "../types";
import {
  formatCurrency,
  splitTicketSnapshot,
  toTimeInputValue,
  buildSubCategoryMasterMap,
  PAYMENT_METHOD_LABEL,
} from "../utils/formatters";

interface SummaryProps {
  session: OperationalSession;
  /** Seluruh transaksi milik sesi ini (semua status) — Summary yang menyaring sendiri. */
  transactions: TransactionEntry[];
}

const PAYMENT_METHODS = ["qris", "card", "cash"] as const;

const Summary: React.FC<SummaryProps> = ({ session, transactions }) => {
  // --- Nama master (untuk label "Nama Master — Nama Varian") ---
  const [masterNameMap, setMasterNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    apiGet<TicketMaster[]>("/ticket-masters")
      .then((masters) => {
        if (!cancelled) setMasterNameMap(buildSubCategoryMasterMap(masters));
      })
      .catch(() => {
        // Non-blocking: label master induk cukup ditinggalkan kosong kalau gagal.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Jendela waktu = jam sesi itu sendiri (TIDAK bisa diubah user lagi —
  // sesuai permintaan "hapus filter, auto-load berdasarkan jam sesi"). ---
  const windowStart = toTimeInputValue(session.start_time) || "00:00";
  const windowEnd = toTimeInputValue(session.end_time) || "23:59";

  // =========================================================
  // 0. TRANSAKSI UNTUK STATISTIK — auto: status Lunas/Dikonfirmasi (paid/
  //    confirmed), dalam jam sesi. Tidak ada lagi kontrol filter manual;
  //    ini murni dihitung otomatis dari data yang sudah ada.
  // =========================================================
  const statsTransactions = useMemo(() => {
    const byStatus = transactions.filter((tx) => tx.status === "confirmed" || tx.status === "paid");

    const [startH, startM] = windowStart.split(":").map(Number);
    const [endH, endM] = windowEnd.split(":").map(Number);
    if (isNaN(startH) || isNaN(endH)) return byStatus;

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    const actualStart = Math.min(startMins, endMins);
    const actualEnd = Math.max(startMins, endMins);

    return byStatus.filter((tx) => {
      if (!tx.created_at) return true;
      const date = new Date(tx.created_at);
      const txMins = date.getHours() * 60 + date.getMinutes();
      return txMins >= actualStart && txMins <= actualEnd;
    });
  }, [transactions, windowStart, windowEnd]);

  // =========================================================
  // 1. STATISTIK UTAMA — dinamis per nama varian usia
  // =========================================================
  const dynamicStats = useMemo(() => {
    let revenue = 0;
    const byVariant: Record<string, number> = {};

    statsTransactions.forEach((tx) => {
      revenue += tx.total_price || 0;
      const seenVariants = new Set<string>();
      tx.items.forEach((item) => {
        const { variant } = splitTicketSnapshot(item.ticket_name_snapshot);
        const key = variant || item.ticket_name_snapshot;
        if (!seenVariants.has(key)) {
          byVariant[key] = (byVariant[key] || 0) + item.quantity;
          seenVariants.add(key);
        }
      });
    });

    const visitors = Object.values(byVariant).reduce((s, v) => s + v, 0);
    return { visitors, byVariant, revenue };
  }, [statsTransactions]);

  const variantNames = useMemo(() => Object.keys(dynamicStats.byVariant).sort(), [dynamicStats]);

  // =========================================================
  // 2. KUNJUNGAN PER MASTER (dulu "per lantai")
  // =========================================================
  const groupStats = useMemo(() => {
    const stats: Record<string, number> = {};

    statsTransactions.forEach((tx) => {
      const seenInGroup = new Set<string>();
      tx.items.forEach((item) => {
        const { group, variant } = splitTicketSnapshot(item.ticket_name_snapshot);
        const dedupeKey = `${group}::${variant}`;
        if (seenInGroup.has(dedupeKey)) return;
        seenInGroup.add(dedupeKey);
        stats[group] = (stats[group] || 0) + item.quantity;
      });
    });

    return Object.entries(stats).sort();
  }, [statsTransactions]);

  // =========================================================
  // 3. DISTRIBUSI NEGARA
  // =========================================================
  const countryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    statsTransactions.forEach((tx) => {
      tx.origins.forEach((origin) => {
        const code = origin.country_code.toUpperCase();
        stats[code] = (stats[code] || 0) + origin.count;
      });
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [statsTransactions]);

  // =========================================================
  // 4. REKAP PENJUALAN PER VARIAN x METODE PEMBAYARAN
  // =========================================================
  const salesSummary = useMemo(() => {
    interface Row {
      subCategoryId: string;
      label: string;
      price: number;
      byMethod: Record<string, { qty: number; nominal: number }>;
    }

    const rowMap = new Map<string, Row>();
    session.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      const masterName = masterNameMap[sub.id] || "";
      rowMap.set(sub.id, {
        subCategoryId: sub.id,
        label: masterName ? `${masterName} — ${sub.name}` : sub.name,
        price: sub.price,
        byMethod: Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { qty: 0, nominal: 0 }])),
      });
    });

    const totalsByMethod: Record<string, { qty: number; nominal: number }> = Object.fromEntries(
      PAYMENT_METHODS.map((m) => [m, { qty: 0, nominal: 0 }])
    );

    statsTransactions.forEach((tx) => {
      const method = (PAYMENT_METHODS as readonly string[]).includes(tx.payment_method) ? tx.payment_method : "qris";
      tx.items.forEach((item) => {
        const row = rowMap.get(item.ticket_sub_category_id);
        if (!row) return;
        const nominal = item.quantity * item.unit_price;
        row.byMethod[method].qty += item.quantity;
        row.byMethod[method].nominal += nominal;
        totalsByMethod[method].qty += item.quantity;
        totalsByMethod[method].nominal += nominal;
      });
    });

    const grandTotalQty = PAYMENT_METHODS.reduce((s, m) => s + totalsByMethod[m].qty, 0);
    const grandTotalNominal = PAYMENT_METHODS.reduce((s, m) => s + totalsByMethod[m].nominal, 0);

    return { rows: Array.from(rowMap.values()), totalsByMethod, grandTotalQty, grandTotalNominal };
  }, [session, masterNameMap, statsTransactions]);

  // =========================================================
  // 5. KEPADATAN PENGUNJUNG PER 30 MENIT — kolom dinamis per master
  // =========================================================
  const groupNames = useMemo(() => {
    const names = new Set<string>();
    session.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      names.add(masterNameMap[sub.id] || "Lainnya");
    });
    return Array.from(names).sort();
  }, [session, masterNameMap]);

  const timeIntervalStats = useMemo(() => {
    const [startH, startM] = windowStart.split(":").map(Number);
    const [endH, endM] = windowEnd.split(":").map(Number);
    if (isNaN(startH) || isNaN(endH)) return [];

    let startMins = startH * 60 + startM;
    let endMins = endH * 60 + endM;
    if (startMins > endMins) {
      const t = startMins;
      startMins = endMins;
      endMins = t;
    }

    const intervals: { label: string; startMin: number; endMin: number; byGroup: Record<string, number>; total: number }[] = [];
    for (let m = startMins; m < endMins; m += 30) {
      const bh = Math.floor(m / 60).toString().padStart(2, "0");
      const bm = (m % 60).toString().padStart(2, "0");
      const nextM = Math.min(m + 30, endMins);
      const eh = Math.floor(nextM / 60).toString().padStart(2, "0");
      const em = (nextM % 60).toString().padStart(2, "0");
      intervals.push({
        label: `${bh}:${bm} - ${eh}:${em}`,
        startMin: m,
        endMin: nextM,
        byGroup: Object.fromEntries(groupNames.map((g) => [g, 0])),
        total: 0,
      });
    }

    statsTransactions.forEach((tx) => {
      if (!tx.created_at) return;
      const date = new Date(tx.created_at);
      const txMins = date.getHours() * 60 + date.getMinutes();
      const interval = intervals.find((iv) => txMins >= iv.startMin && txMins < iv.endMin);
      if (!interval) return;

      const seen = new Set<string>();
      tx.items.forEach((item) => {
        const { group, variant } = splitTicketSnapshot(item.ticket_name_snapshot);
        const dedupeKey = `${group}::${variant}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        interval.byGroup[group] = (interval.byGroup[group] || 0) + item.quantity;
        interval.total += item.quantity;
      });
    });

    return intervals;
  }, [statsTransactions, windowStart, windowEnd, groupNames]);

  // =========================================================
  // 6. AUDIT TIKET — fisik vs digital (TIDAK terpengaruh filter
  //    status/waktu di atas; selalu memakai seluruh transaksi sesi
  //    yang tidak dibatalkan, karena nomor tiket fisik tidak punya
  //    konsep "potongan waktu").
  // =========================================================
  const auditRows = useMemo(() => {
    const digitalPerSubCategory = new Map<string, number>();
    transactions
      .filter((tx) => tx.status !== "cancelled")
      .forEach((tx) => {
        tx.items.forEach((item) => {
          digitalPerSubCategory.set(
            item.ticket_sub_category_id,
            (digitalPerSubCategory.get(item.ticket_sub_category_id) || 0) + item.quantity
          );
        });
      });

    return session.active_tickets.map((st) => {
      const sub = st.sub_category;
      const masterName = sub ? masterNameMap[sub.id] || "" : "";
      const label = sub ? (masterName ? `${masterName} — ${sub.name}` : sub.name) : "Varian tiket";

      const start = st.audit?.start_ticket_number ?? null;
      const end = st.audit?.end_ticket_number ?? null;
      const physicalUsed = start !== null && end !== null ? end - start + 1 : null;
      const digitalSold = sub ? digitalPerSubCategory.get(sub.id) || 0 : 0;
      const selisih = physicalUsed !== null ? physicalUsed - digitalSold : null;

      return { id: st.id, label, start, end, physicalUsed, digitalSold, selisih };
    });
  }, [session, transactions, masterNameMap]);

  const auditTotals = useMemo(() => {
    const physical = auditRows.reduce((s, r) => s + (r.physicalUsed || 0), 0);
    const digital = auditRows.reduce((s, r) => s + r.digitalSold, 0);
    return { physical, digital, selisih: physical - digital };
  }, [auditRows]);

  return (
    <div className="space-y-6">
      {/* INFO AUTO-LOAD — tidak ada lagi kontrol filter; ringkasan langsung
          dihitung otomatis dari jam sesi & status Lunas/Dikonfirmasi. */}
      <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-3">
        <svg className="w-5 h-5 text-[#fb9418] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs sm:text-sm text-gray-600 font-medium">
          Menampilkan transaksi <span className="font-bold text-black">Lunas/Dikonfirmasi</span> selama jam sesi{" "}
          <span className="font-bold text-black">
            {windowStart}–{windowEnd}
          </span>
          . Bagian Audit Tiket di bawah selalu memakai seluruh transaksi sesi (tidak dibatasi jendela waktu ini).
        </p>
      </div>

      {/* KARTU STATISTIK — dinamis per varian */}
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
                  <td className="px-4 py-3">TOTAL</td>
                  <td />
                  <td />
                  <td className="px-4 py-3 text-right">{auditTotals.physical}</td>
                  <td className="px-4 py-3 text-right">{auditTotals.digital}</td>
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

      {/* KEPADATAN PENGUNJUNG PER 30 MENIT — kolom dinamis per master */}
      <div className="bg-[#fcfcfc] rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-white">
          <h4 className="text-sm font-extrabold text-black uppercase tracking-wider">Kepadatan Pengunjung (Per 30 Menit)</h4>
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
                  <span className="text-xs font-bold text-[#fb9418] uppercase tracking-widest">{country}</span>
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
