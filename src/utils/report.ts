/**
 * src/utils/report.ts
 * ----------------------------------------------------
 * Kalkulasi Ringkasan untuk SATU ATAU LEBIH sesi operasional.
 *
 * KENAPA ADA: dulu seluruh angka Ringkasan dihitung di dalam `useMemo` di
 * `Summary.tsx` untuk tepat satu sesi. Sejak ada Laporan Gabungan (beberapa
 * sesi dalam satu tanggal) dan ekspor Excel yang bisa dipicu dari tab
 * Riwayat maupun Ringkasan, angka yang SAMA harus bisa dihitung di luar
 * komponen itu. Fungsi murni di sini dipakai bersama oleh layar
 * (`Summary.tsx`) dan berkas unduhan (`reportWorkbook.ts`), jadi keduanya
 * tidak mungkin menyimpang.
 *
 * Per sesi = `computeReport([session], ...)` — hasilnya identik dengan
 * perhitungan satu-sesi sebelumnya.
 */

import { useEffect, useState } from "react";
import { getName } from "country-list";
import { apiGet } from "../api/client";
import { OperationalSession, TicketMaster, TransactionEntry, TransactionItem } from "../types";
import { buildSubCategoryMasterMap, splitTicketSnapshot, toTimeInputValue } from "./formatters";

export const PAYMENT_METHODS = ["qris", "card", "cash"] as const;

/** Lebar potongan waktu pada tabel Kepadatan Pengunjung, dalam menit. */
export const DENSITY_INTERVAL_MINUTES = 15;

export interface SessionWindow {
  sessionId: string;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
  startMin: number;
  endMin: number;
}

export interface DensityInterval {
  label: string;
  startMin: number;
  endMin: number;
  byGroup: Record<string, number>;
  total: number;
}

export interface SalesRow {
  subCategoryId: string;
  label: string;
  price: number;
  byMethod: Record<string, { qty: number; nominal: number }>;
}

export interface AuditRow {
  id: string;
  label: string;
  start: number | null;
  end: number | null;
  physicalUsed: number | null;
  digitalSold: number;
  selisih: number | null;
}

export interface ReportData {
  windows: SessionWindow[];
  /** Label jam seluruh sesi, mis. "10:00–12:00 & 15:00–17:00". */
  windowsLabel: string;
  statsTransactions: TransactionEntry[];
  dynamicStats: { visitors: number; byVariant: Record<string, number>; revenue: number };
  variantNames: string[];
  groupStats: [string, number][];
  /** [kode negara huruf besar, jumlah], urut terbanyak. */
  countryStats: [string, number][];
  salesSummary: {
    rows: SalesRow[];
    totalsByMethod: Record<string, { qty: number; nominal: number }>;
    grandTotalQty: number;
    grandTotalNominal: number;
  };
  groupNames: string[];
  timeIntervalStats: DensityInterval[];
  auditRows: AuditRow[];
  auditTotals: { physical: number; digital: number; selisih: number };
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return isNaN(h) ? NaN : h * 60 + (m || 0);
};

const minutesToLabel = (mins: number): string =>
  `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;

/** Nama lengkap negara dari kode ISO ("ID" -> "Indonesia"); jatuh ke kode kalau tidak dikenal. */
export function countryName(code: string): string {
  return getName(code.toUpperCase()) || code.toUpperCase();
}

/** Peta `ticket_sub_category_id -> nama master` untuk label "Nama Master — Nama Varian". */
export function useMasterNameMap(): Record<string, string> {
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

  return masterNameMap;
}

export function computeReport(
  sessions: OperationalSession[],
  transactions: TransactionEntry[],
  masterNameMap: Record<string, string>
): ReportData {
  const multi = sessions.length > 1;

  /**
   * Peta `ticket_sub_category_id -> age_category_id` (gabungan semua sesi).
   *
   * KENAPA PERLU: sejak pengunjung boleh memilih beberapa lantai sekaligus,
   * SATU orang menghasilkan beberapa baris item — "Lantai 1 - Dewasa" dan
   * "Lantai 2 - Dewasa" untuk orang yang sama. Kalau item dijumlahkan
   * begitu saja, 4 orang yang membeli 2 lantai akan terbaca 8 pengunjung.
   *
   * Master varian usia memberi kunci yang benar untuk mendeteksi hal itu:
   * kedua baris tadi punya `age_category_id` yang sama, jadi cukup dihitung
   * sekali per transaksi.
   */
  const ageCategoryBySubId = new Map<string, string>();
  sessions.forEach((s) =>
    s.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (sub?.age_category_id) ageCategoryBySubId.set(sub.id, sub.age_category_id);
    })
  );

  /**
   * Kunci dedupe "satu orang" di dalam satu transaksi.
   *
   * Utamanya `age_category_id`. Untuk data lama yang variannya belum
   * tertaut master varian usia (hasil migrasi yang tidak menemukan
   * padanan), jatuh ke nama varian dari snapshot — perilaku persis seperti
   * sebelum v2, jadi laporan lama tidak berubah angkanya.
   */
  const dedupeKeyFor = (item: TransactionItem): string => {
    const ageId = ageCategoryBySubId.get(item.ticket_sub_category_id);
    if (ageId) return `age:${ageId}`;
    const { variant } = splitTicketSnapshot(item.ticket_name_snapshot);
    return `name:${variant || item.ticket_name_snapshot}`;
  };

  // =========================================================
  // 0. JENDELA WAKTU — satu per sesi (jam sesi itu sendiri), diurutkan
  //    dari yang paling awal.
  // =========================================================
  const windows: SessionWindow[] = sessions
    .map((s) => {
      const start = toTimeInputValue(s.start_time) || "00:00";
      const end = toTimeInputValue(s.end_time) || "23:59";
      const a = toMinutes(start);
      const b = toMinutes(end);
      return { sessionId: s.id, start, end, startMin: Math.min(a, b), endMin: Math.max(a, b) };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const windowsLabel = windows.map((w) => `${w.start}–${w.end}`).join(" & ");
  const windowBySession = new Map(windows.map((w) => [w.sessionId, w]));

  // Transaksi untuk statistik: status Lunas/Dikonfirmasi, di dalam jam
  // SESI MILIKNYA SENDIRI (bukan satu jendela global untuk semua sesi).
  const statsTransactions = transactions.filter((tx) => {
    if (tx.status !== "confirmed" && tx.status !== "paid") return false;
    const w = windowBySession.get(tx.session_id);
    if (!w || isNaN(w.startMin) || isNaN(w.endMin)) return true;
    if (!tx.created_at) return true;
    const date = new Date(tx.created_at);
    const txMins = date.getHours() * 60 + date.getMinutes();
    return txMins >= w.startMin && txMins <= w.endMin;
  });

  // =========================================================
  // 1. STATISTIK UTAMA — dinamis per nama varian usia
  // =========================================================
  let revenue = 0;
  const byVariant: Record<string, number> = {};
  statsTransactions.forEach((tx) => {
    revenue += tx.total_price || 0;
    // Satu orang yang membeli beberapa lantai hanya dihitung SEKALI.
    const seen = new Set<string>();
    tx.items.forEach((item) => {
      const key = dedupeKeyFor(item);
      if (seen.has(key)) return;
      seen.add(key);
      const { variant } = splitTicketSnapshot(item.ticket_name_snapshot);
      const label = variant || item.ticket_name_snapshot;
      byVariant[label] = (byVariant[label] || 0) + item.quantity;
    });
  });
  const visitors = Object.values(byVariant).reduce((s, v) => s + v, 0);
  const dynamicStats = { visitors, byVariant, revenue };
  const variantNames = Object.keys(byVariant).sort();

  // =========================================================
  // 2. KUNJUNGAN PER MASTER (dulu "per lantai")
  // =========================================================
  // Dedupe di sini sengaja PER MASTER (lantai), bukan lintas-lantai:
  // pertanyaan yang dijawab tabel ini adalah "berapa orang yang masuk ke
  // Lantai 1?", dan orang yang membeli 2 lantai memang berkunjung ke
  // dua-duanya. Jadi ia benar untuk dihitung di kedua baris.
  const groupCounts: Record<string, number> = {};
  statsTransactions.forEach((tx) => {
    const seenInGroup = new Set<string>();
    tx.items.forEach((item) => {
      const { group } = splitTicketSnapshot(item.ticket_name_snapshot);
      const dedupeKey = `${group}::${dedupeKeyFor(item)}`;
      if (seenInGroup.has(dedupeKey)) return;
      seenInGroup.add(dedupeKey);
      groupCounts[group] = (groupCounts[group] || 0) + item.quantity;
    });
  });
  const groupStats = Object.entries(groupCounts).sort();

  // =========================================================
  // 3. DISTRIBUSI NEGARA
  // =========================================================
  const countryCounts: Record<string, number> = {};
  statsTransactions.forEach((tx) => {
    tx.origins.forEach((origin) => {
      const code = origin.country_code.toUpperCase();
      countryCounts[code] = (countryCounts[code] || 0) + origin.count;
    });
  });
  const countryStats = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

  // =========================================================
  // 4. REKAP PENJUALAN PER VARIAN x METODE PEMBAYARAN
  //    Varian yang sama di beberapa sesi digabung jadi satu baris.
  // =========================================================
  const rowMap = new Map<string, SalesRow>();
  sessions.forEach((s) =>
    s.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub || rowMap.has(sub.id)) return;
      const masterName = masterNameMap[sub.id] || "";
      rowMap.set(sub.id, {
        subCategoryId: sub.id,
        label: masterName ? `${masterName} — ${sub.name}` : sub.name,
        price: sub.price,
        byMethod: Object.fromEntries(PAYMENT_METHODS.map((m) => [m, { qty: 0, nominal: 0 }])),
      });
    })
  );

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

  const salesSummary = {
    rows: Array.from(rowMap.values()),
    totalsByMethod,
    grandTotalQty: PAYMENT_METHODS.reduce((s, m) => s + totalsByMethod[m].qty, 0),
    grandTotalNominal: PAYMENT_METHODS.reduce((s, m) => s + totalsByMethod[m].nominal, 0),
  };

  // =========================================================
  // 5. KEPADATAN PENGUNJUNG PER 15 MENIT — kolom dinamis per master
  // =========================================================
  const groupNameSet = new Set<string>();
  sessions.forEach((s) =>
    s.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      groupNameSet.add(masterNameMap[sub.id] || "Lainnya");
    })
  );
  const groupNames = Array.from(groupNameSet).sort();

  // Jendela yang tumpang tindih/bersebelahan digabung jadi satu segmen.
  // Jeda antarsesi (mis. 12:00–15:00 di antara sesi 10–12 dan 15–17)
  // TIDAK menghasilkan baris sama sekali.
  const segments: { startMin: number; endMin: number }[] = [];
  windows.forEach((w) => {
    if (isNaN(w.startMin) || isNaN(w.endMin)) return;
    const last = segments[segments.length - 1];
    if (last && w.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, w.endMin);
    } else {
      segments.push({ startMin: w.startMin, endMin: w.endMin });
    }
  });

  const timeIntervalStats: DensityInterval[] = [];
  segments.forEach((seg) => {
    for (let m = seg.startMin; m < seg.endMin; m += DENSITY_INTERVAL_MINUTES) {
      const nextM = Math.min(m + DENSITY_INTERVAL_MINUTES, seg.endMin);
      timeIntervalStats.push({
        label: `${minutesToLabel(m)} - ${minutesToLabel(nextM)}`,
        startMin: m,
        endMin: nextM,
        byGroup: Object.fromEntries(groupNames.map((g) => [g, 0])),
        total: 0,
      });
    }
  });

  statsTransactions.forEach((tx) => {
    if (!tx.created_at) return;
    const date = new Date(tx.created_at);
    const txMins = date.getHours() * 60 + date.getMinutes();
    const interval = timeIntervalStats.find((iv) => txMins >= iv.startMin && txMins < iv.endMin);
    if (!interval) return;

    const seen = new Set<string>();
    tx.items.forEach((item) => {
      const { group } = splitTicketSnapshot(item.ticket_name_snapshot);
      const dedupeKey = `${group}::${dedupeKeyFor(item)}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      interval.byGroup[group] = (interval.byGroup[group] || 0) + item.quantity;
      interval.total += item.quantity;
    });
  });

  // =========================================================
  // 6. AUDIT TIKET — fisik vs digital (TIDAK terpengaruh filter
  //    status/waktu di atas; selalu memakai seluruh transaksi sesi
  //    yang tidak dibatalkan, karena nomor tiket fisik tidak punya
  //    konsep "potongan waktu"). Nomor fisik tercatat PER SESI, jadi
  //    penjualan digital juga dihitung per (sesi, varian).
  // =========================================================
  const digitalPerSessionSub = new Map<string, number>();
  transactions
    .filter((tx) => tx.status !== "cancelled")
    .forEach((tx) => {
      tx.items.forEach((item) => {
        const key = `${tx.session_id}:${item.ticket_sub_category_id}`;
        digitalPerSessionSub.set(key, (digitalPerSessionSub.get(key) || 0) + item.quantity);
      });
    });

  const auditRows: AuditRow[] = sessions.flatMap((s) =>
    s.active_tickets.map((st) => {
      const sub = st.sub_category;
      const masterName = sub ? masterNameMap[sub.id] || "" : "";
      const baseLabel = sub ? (masterName ? `${masterName} — ${sub.name}` : sub.name) : "Varian tiket";
      const label = multi ? `${s.name} · ${baseLabel}` : baseLabel;

      const start = st.audit?.start_ticket_number ?? null;
      const end = st.audit?.end_ticket_number ?? null;
      const physicalUsed = start !== null && end !== null ? end - start + 1 : null;
      const digitalSold = sub ? digitalPerSessionSub.get(`${s.id}:${sub.id}`) || 0 : 0;
      const selisih = physicalUsed !== null ? physicalUsed - digitalSold : null;

      return { id: st.id, label, start, end, physicalUsed, digitalSold, selisih };
    })
  );

  const physical = auditRows.reduce((sum, r) => sum + (r.physicalUsed || 0), 0);
  const digital = auditRows.reduce((sum, r) => sum + r.digitalSold, 0);
  const auditTotals = { physical, digital, selisih: physical - digital };

  return {
    windows,
    windowsLabel,
    statsTransactions,
    dynamicStats,
    variantNames,
    groupStats,
    countryStats,
    salesSummary,
    groupNames,
    timeIntervalStats,
    auditRows,
    auditTotals,
  };
}
