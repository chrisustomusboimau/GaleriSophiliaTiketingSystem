/**
 * ManualEntryModal.tsx (src/components/admin)
 * ----------------------------------------------------
 * Modal bagi kasir/admin untuk membuat transaksi baru secara manual,
 * SELALU untuk sesi yang sedang dilihat di `/sesi/:sessionId` (bukan
 * lagi "sesi aktif global" lewat `/sessions/active`) — supaya kasir
 * tidak salah membuat tiket untuk sesi lain yang kebetulan juga sedang
 * berjalan hari itu. Tiket hanya bisa dibuat kalau sesi ini
 * berstatus 'opened'.
 *
 * `customer_name` WAJIB diisi (backend: `TransactionCreate.customer_name
 * = Field(..., min_length=1)`).
 *
 * UPDATE v2: metode pembayaran tidak lagi dipilih lewat radio
 * QRIS/Kartu/Tunai yang lepas. Kasir memilih TERMINAL yang dipakai
 * menagih (dari sesi kasirnya), dan terminal itulah yang menetapkan
 * kategori sekaligus detail metode pembayaran — supaya keduanya tidak
 * pernah bisa saling bertentangan.
 *
 * UPDATE v4 — PILIH LANTAI (MINIMALIS) + HARGA TERAKUMULASI PER
 * KATEGORI USIA, MENIRU PERSIS LOGIKA `VisitorForm.tsx`:
 *
 * Step 1 sekarang HANYA daftar nama Master Tiket (checkbox polos, tanpa
 * harga/atribut lain) — beda dari v3 yang masih pakai `FloorCard`
 * lengkap dengan rincian harga per varian.
 *
 * Step 2 tidak lagi satu grup counter PER LANTAI. Sekarang satu counter
 * PER KATEGORI USIA (dikunci oleh `age_category_id`, sama seperti
 * `VisitorForm`), dan harga yang ditampilkan adalah AKUMULASI harga
 * kategori itu di SELURUH lantai yang dicentang. Konsekuensinya:
 *
 *   - Satu angka yang diketik kasir = jumlah ORANG (fisik), berlaku
 *     untuk semua lantai terpilih yang menjual kategori usia itu.
 *   - Saat dikirim ke backend, satu orang di N lantai terpilih menjadi
 *     N item tiket (satu per lantai, masing-masing di harga lantainya
 *     sendiri) — lihat `handleSubmit`.
 *   - Kalau kasir hanya perlu jumlah BERBEDA per lantai untuk grup
 *     usia yang sama (mis. 2 Dewasa hanya ke Lantai 1, 5 Dewasa lain
 *     hanya ke Lantai 2), itu berarti DUA transaksi terpisah — sesuai
 *     desain "tiket kombo lintas lantai" yang diminta, bukan lagi
 *     input bebas per kombinasi lantai×kategori seperti versi lama.
 *
 * `floorList` & `ageVariants` diturunkan LANGSUNG dari
 * `session.active_tickets` (`sub_category` sudah membawa
 * `ticket_master_id`, `ticket_master_name`, & `age_category_id` dari
 * backend) — tidak perlu lagi memanggil `GET /ticket-masters` terpisah.
 */

import React, { useEffect, useMemo, useState } from "react";
import { getData } from "country-list";
import { apiGet, apiPost, ApiError } from "../../api/client";
import { OperationalSession, TransactionEntry } from "../../types";
import { formatCurrency } from "../../utils/formatters";
import { useCashierSession } from "../../contexts/CashierSessionContext";
import TerminalPicker, { PaymentSelection } from "./TerminalPicker";

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transaction: TransactionEntry) => void;
  /** Sesi tujuan pembuatan tiket manual ini. */
  sessionId: string;
}

const COUNTRIES = Object.freeze(getData().map((c) => ({ code: c.code.toLowerCase(), name: c.name })));

interface CountryVisitor {
  countryCode: string;
  count: number | string;
}

/** Satu lantai (Master Tiket) tempat sebuah kategori usia dijual, beserta harganya di sana. */
interface VariantLocation {
  masterId: string;
  masterName: string;
  subCategoryId: string;
  price: number;
}

/** Satu baris counter di Step 2: SATU kategori usia, berlaku untuk semua lantai terpilih yang menjualnya. */
interface AgeVariantRow {
  /** `age_category_id`, atau nama varian untuk data lama yang belum tertaut. */
  key: string;
  displayName: string;
  locations: VariantLocation[];
  /** Harga SATU orang, dijumlahkan di SELURUH lantai terpilih yang menjualnya. */
  totalPricePerPerson: number;
}

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ isOpen, onClose, onSuccess, sessionId }) => {
  const [targetSession, setTargetSession] = useState<OperationalSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { terminals } = useCashierSession();

  const [customerName, setCustomerName] = useState("");
  /** Master tiket (lantai) yang sedang dicentang di Step 1. Bisa lebih dari satu. */
  const [selectedFloorIds, setSelectedFloorIds] = useState<string[]>([]);
  /** Jumlah orang per KATEGORI USIA (kunci = `AgeVariantRow.key`), bukan lagi per sub-kategori/lantai. */
  const [ageCounts, setAgeCounts] = useState<Record<string, number>>({});
  /**
   * Pembayaran Tunai TIDAK diperbolehkan di modal ini (lihat efek
   * "Preseleksi terminal" di bawah) — `null` berarti belum ada terminal
   * non-tunai yang bisa dipakai sebagai default (submit akan diblokir
   * sampai kasir memilih salah satu, atau sesi kasirnya ditutup-buka
   * ulang dengan terminal EDC/QRIS).
   */
  const [payment, setPayment] = useState<PaymentSelection | null>(null);
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([{ countryCode: "id", count: 1 }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Ambil sesi TUJUAN (bukan sesi aktif global) setiap kali modal dibuka ---
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoadingSession(true);
      setSessionError(null);
      setTargetSession(null);
      try {
        const session = await apiGet<OperationalSession>(`/sessions/${sessionId}`);
        setTargetSession(session);
        setSelectedFloorIds([]);
        setAgeCounts({});
      } catch (err) {
        setSessionError(err instanceof ApiError ? err.message : "Gagal memuat data sesi.");
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadData();
  }, [isOpen, sessionId]);

  // Preseleksi terminal NON-TUNAI pertama milik kasir — pilihan yang
  // paling sering benar, dan tetap bisa diganti. Tunai tidak lagi jadi
  // fallback di modal ini: kalau sesi kasirnya tidak punya satu pun
  // terminal EDC/QRIS, `payment` dibiarkan `null` dan submit diblokir
  // (lihat validasi di `handleSubmit`) sampai terminal yang sesuai
  // tersedia.
  useEffect(() => {
    if (!isOpen) return;
    const nonCashTerminal = terminals.find((t) => t.category !== "cash");
    setPayment(nonCashTerminal ? { terminalId: nonCashTerminal.id, category: nonCashTerminal.category } : null);
  }, [isOpen, terminals]);

  const isSessionOpen = targetSession?.status === "opened";

  /**
   * --- Step 1 data source: daftar nama lantai polos, tanpa harga ---
   * Cukup id + label per Master Tiket unik yang punya tiket aktif pada
   * sesi ini.
   */
  const floorList = useMemo(() => {
    if (!targetSession) return [];
    const seen = new Map<string, string>();
    targetSession.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub || !sub.ticket_master_id) return;
      if (!seen.has(sub.ticket_master_id)) {
        seen.set(sub.ticket_master_id, sub.ticket_master_name || "Tiket");
      }
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [targetSession]);

  /** Tiket aktif yang relevan = milik salah satu lantai yang dicentang di Step 1. */
  const relevantTickets = useMemo(() => {
    if (!targetSession) return [];
    return targetSession.active_tickets.filter((st) => {
      const sub = st.sub_category;
      return !!sub && !!sub.ticket_master_id && selectedFloorIds.includes(sub.ticket_master_id);
    });
  }, [targetSession, selectedFloorIds]);

  /**
   * --- Step 2 data source: gabungkan kategori usia yang SAMA lintas
   * lantai jadi satu baris, dan JUMLAHKAN harganya ---
   * Kuncinya `age_category_id` — persis logika yang sudah dipakai di
   * halaman pembelian tiket pengunjung (`VisitorForm.tsx`), supaya
   * "Dewasa" di Lantai 1 dan "Dewasa" di Lantai 2 dikenali sebagai
   * kategori yang sama. Data lama yang belum tertaut master varian usia
   * jatuh ke pengelompokan by nama.
   */
  const ageVariants: AgeVariantRow[] = useMemo(() => {
    const map = new Map<string, AgeVariantRow>();
    relevantTickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      const key = sub.age_category_id || `name:${sub.name}`;
      if (!map.has(key)) {
        map.set(key, { key, displayName: sub.name, locations: [], totalPricePerPerson: 0 });
      }
      const row = map.get(key)!;
      row.locations.push({
        masterId: sub.ticket_master_id,
        masterName: sub.ticket_master_name || "Tiket",
        subCategoryId: sub.id,
        price: sub.price,
      });
      row.totalPricePerPerson += sub.price;
    });
    return Array.from(map.values());
  }, [relevantTickets]);

  // Sinkronkan `ageCounts` dengan baris yang sedang tampil: pertahankan
  // angka untuk kategori yang masih relevan (mis. tetap terjual di
  // sisa lantai yang masih dicentang), buang kategori yang sudah tidak
  // dijual sama sekali oleh lantai terpilih.
  useEffect(() => {
    setAgeCounts((prev) => {
      const next: Record<string, number> = {};
      ageVariants.forEach((v) => {
        next[v.key] = prev[v.key] ?? 0;
      });
      return next;
    });
  }, [ageVariants]);

  /** ORANG FISIK per kategori usia — dasar validasi Asal Negara & pengiriman ke backend. */
  const totalPeople = useMemo(
    () => ageVariants.reduce((sum, v) => sum + (ageCounts[v.key] || 0), 0),
    [ageVariants, ageCounts]
  );

  const totalFromCountries = useMemo(
    () => countryVisitors.reduce((sum, c) => sum + (parseInt(c.count as string, 10) || 0), 0),
    [countryVisitors]
  );

  /** Harga total = orang × harga terakumulasi per kategori (sudah mencakup semua lantai terpilih). */
  const totalPrice = useMemo(
    () => ageVariants.reduce((sum, v) => sum + (ageCounts[v.key] || 0) * v.totalPricePerPerson, 0),
    [ageVariants, ageCounts]
  );

  if (!isOpen) return null;

  // --- Handlers ---

  const toggleFloorSelection = (floorId: string) => {
    setSelectedFloorIds((prev) =>
      prev.includes(floorId) ? prev.filter((id) => id !== floorId) : [...prev, floorId]
    );
  };

  const adjustQuantity = (variantKey: string, delta: number) => {
    setAgeCounts((prev) => ({
      ...prev,
      [variantKey]: Math.max(0, (prev[variantKey] || 0) + delta),
    }));
  };

  const handleQuantityInput = (variantKey: string, value: string) => {
    const parsed = Math.max(0, parseInt(value, 10) || 0);
    setAgeCounts((prev) => ({ ...prev, [variantKey]: parsed }));
  };

  const handleAddCountry = () => setCountryVisitors((prev) => [...prev, { countryCode: "id", count: "" }]);

  const handleUpdateCountry = (index: number, key: keyof CountryVisitor, value: string) => {
    setCountryVisitors((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  };

  const handleRemoveCountry = (index: number) => setCountryVisitors((prev) => prev.filter((_, i) => i !== index));

  const handleClose = () => {
    setCustomerName("");
    setSelectedFloorIds([]);
    setAgeCounts({});
    setCountryVisitors([{ countryCode: "id", count: 1 }]);
    setPayment(null);
    setFormError(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!targetSession) {
      setFormError("Sesi tidak ditemukan.");
      return;
    }

    if (!isSessionOpen) {
      setFormError(`Sesi ini berstatus '${targetSession.status}'. Tiket hanya bisa dibuat saat sesi berstatus 'Dibuka'.`);
      return;
    }

    if (!customerName.trim()) {
      setFormError("Nama pemesan wajib diisi.");
      return;
    }

    if (selectedFloorIds.length === 0) {
      setFormError("Pilih setidaknya satu lantai/lokasi tiket.");
      return;
    }

    if (totalPeople === 0) {
      setFormError("Silakan masukkan setidaknya 1 pengunjung.");
      return;
    }

    if (totalPeople !== totalFromCountries) {
      setFormError(
        `Jumlah total pengunjung (${totalPeople}) tidak sama dengan total pengunjung dari daftar asal negara (${totalFromCountries}).`
      );
      return;
    }

    // Pembayaran Tunai tidak diperbolehkan di modal ini — `payment` null
    // atau `terminalId` null (ciri khas Tunai, lihat `CASH_SELECTION` di
    // TerminalPicker) berarti belum ada terminal EDC/QRIS yang valid
    // terpilih. Pemeriksaan ini jaring pengaman terakhir di samping UI
    // yang memang sudah menyembunyikan opsi Tunai (`excludeCash`).
    if (!payment || !payment.terminalId) {
      setFormError(
        "Pilih metode pembayaran non-tunai (terminal EDC/QRIS) — Tunai tidak diperbolehkan untuk transaksi manual."
      );
      return;
    }

    // Di sinilah orang fisik diterjemahkan jadi unit tiket: satu item
    // per (kategori usia × lantai terpilih yang menjualnya), masing-
    // masing sebanyak jumlah orang yang diisi di kategori itu.
    const items: { ticket_sub_category_id: string; quantity: number }[] = [];
    ageVariants.forEach((variant) => {
      const qty = ageCounts[variant.key] || 0;
      if (qty <= 0) return;
      variant.locations.forEach((loc) => {
        items.push({ ticket_sub_category_id: loc.subCategoryId, quantity: qty });
      });
    });

    const origins = countryVisitors.map((c) => ({
      country_code: c.countryCode,
      count: Math.max(0, parseInt(c.count as string, 10) || 0),
    }));

    setIsSubmitting(true);
    try {
      const transaction = await apiPost<TransactionEntry>("/transactions", {
        customer_name: customerName.trim(),
        // Kategori tetap dikirim sebagai dasar; kalau ada terminal,
        // backend menurunkan kategorinya dari terminal itu.
        payment_method: payment.category,
        payment_terminal_id: payment.terminalId,
        items,
        origins,
      });
      handleClose();
      onSuccess(transaction);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal membuat transaksi manual.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm transition-opacity"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all border border-gray-200">
        <div className="bg-black px-6 py-5 flex justify-between items-center text-[#fcfcfc] shrink-0 border-b-4 border-[#fb9418]">
          <h3 className="font-bold text-lg uppercase tracking-wider text-[#fb9418]">Tambah Manual</h3>
          <button onClick={handleClose} disabled={isSubmitting} className="text-gray-400 hover:text-white text-2xl font-bold leading-none transition-colors">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col max-h-[85vh]">
          <div className="overflow-y-auto pr-2 space-y-7 flex-1 custom-scrollbar">
            {isLoadingSession && (
              <div className="text-center py-8 text-gray-400 font-medium text-sm">Memuat data sesi...</div>
            )}

            {!isLoadingSession && sessionError && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r shadow-sm">
                {sessionError}
              </div>
            )}

            {!isLoadingSession && targetSession && !isSessionOpen && (
              <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-800 text-sm rounded-r shadow-sm">
                Sesi <strong>{targetSession.name}</strong> berstatus <strong>'{targetSession.status}'</strong>. Tiket
                hanya bisa dibuat saat sesi berstatus 'Dibuka'.
              </div>
            )}

            {!isLoadingSession && targetSession && (
              <>
                {/* 1. NAMA PEMESAN */}
                <div>
                  <label className="block text-sm font-extrabold text-black mb-3 border-b border-gray-200 pb-2 uppercase tracking-wide">
                    1. Nama Pemesan
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    disabled={isSubmitting || !isSessionOpen}
                    required
                    placeholder="Nama pengunjung"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>

                {/* 2. PILIH LANTAI — daftar nama polos, tanpa harga/atribut lain */}
                <div>
                  <label className="block text-sm font-extrabold text-black mb-3 border-b border-gray-200 pb-2 uppercase tracking-wide">
                    2. Pilih Lantai ({targetSession.name})
                  </label>
                  <div className="space-y-1.5">
                    {floorList.map((floor) => (
                      <label
                        key={floor.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-orange-50/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFloorIds.includes(floor.id)}
                          onChange={() => toggleFloorSelection(floor.id)}
                          disabled={isSubmitting || !isSessionOpen}
                          className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418]"
                        />
                        <span className="text-sm text-black font-bold">{floor.label}</span>
                      </label>
                    ))}
                    {floorList.length === 0 && (
                      <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                        Sesi ini belum memiliki tiket aktif.
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. JUMLAH PENGUNJUNG — satu counter per kategori usia, harga terakumulasi
                       otomatis dari seluruh lantai yang dicentang di Step 2 */}
                <div>
                  <label className="block text-sm font-extrabold text-black mb-3 border-b border-gray-200 pb-2 uppercase tracking-wide">
                    3. Jumlah Pengunjung
                  </label>
                  <div className="space-y-3">
                    {ageVariants.map((variant) => (
                      <div key={variant.key} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-gray-800">{variant.displayName}</span>
                          <span className="text-xs font-bold text-black">
                            {formatCurrency(variant.totalPricePerPerson)}{" "}
                            <span className="text-gray-400 font-normal">/ orang</span>
                          </span>
                        </div>

                        {/* Rincian akumulasi harga per lantai terpilih — transparan kalau ada >1 lantai */}
                        {variant.locations.length > 1 && (
                          <div className="mb-2 space-y-0.5">
                            {variant.locations.map((loc) => (
                              <div key={loc.subCategoryId} className="flex justify-between text-[11px] text-gray-400">
                                <span className="truncate mr-2">{loc.masterName}</span>
                                <span className="font-mono shrink-0">{formatCurrency(loc.price)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm w-fit">
                          <button
                            type="button"
                            onClick={() => adjustQuantity(variant.key, -1)}
                            disabled={isSubmitting || !isSessionOpen || (ageCounts[variant.key] || 0) <= 0}
                            className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={ageCounts[variant.key] ?? 0}
                            onChange={(e) => handleQuantityInput(variant.key, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            disabled={isSubmitting || !isSessionOpen}
                            className="w-12 h-8 text-center font-bold text-black border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-[#fb9418] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => adjustQuantity(variant.key, 1)}
                            disabled={isSubmitting || !isSessionOpen}
                            className="w-8 h-8 flex items-center justify-center font-bold text-[#fb9418] hover:bg-orange-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                    {ageVariants.length === 0 && (
                      <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                        Pilih lantai di Step 2 dahulu untuk menampilkan kategori usia & harganya di sini.
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. ASAL NEGARA */}
                <div>
                  <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                    <label className="block text-sm font-extrabold text-black uppercase tracking-wide">4. Asal Negara</label>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full border ${
                        totalPeople !== totalFromCountries
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-green-50 text-green-700 border-green-200"
                      }`}
                    >
                      {totalFromCountries} / {totalPeople} Orang
                    </span>
                  </div>
                  <div className="space-y-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    {countryVisitors.map((country, index) => (
                      <div key={index} className="flex flex-row items-center gap-2 w-full">
                        <select
                          value={country.countryCode}
                          onChange={(e) => handleUpdateCountry(index, "countryCode", e.target.value)}
                          disabled={isSubmitting || !isSessionOpen}
                          className="flex-[3] min-w-0 p-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] text-sm text-black truncate"
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={country.count}
                          onChange={(e) => handleUpdateCountry(index, "count", e.target.value)}
                          onFocus={(e) => e.target.select()}
                          disabled={isSubmitting || !isSessionOpen}
                          className="flex-1 min-w-0 p-2 text-center font-bold text-black bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none"
                        />
                        {countryVisitors.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveCountry(index)}
                            disabled={isSubmitting || !isSessionOpen}
                            className="flex-none w-8 h-8 flex items-center justify-center font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                          >
                            ✕
                          </button>
                        ) : (
                          <div className="w-8 flex-none" />
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddCountry}
                      disabled={isSubmitting || !isSessionOpen}
                      className="mt-3 text-sm font-bold text-[#fb9418] hover:text-orange-600 flex items-center gap-1"
                    >
                      <span className="text-lg leading-none">+</span> Tambah Negara
                    </button>
                  </div>
                </div>

                {/* 5. METODE PEMBAYARAN — terminal, bukan kategori lepas. Tunai tidak
                       tersedia di modal ini (lihat prop `excludeCash`). */}
                <div>
                  <label className="block text-sm font-extrabold text-black mb-1 border-b border-gray-200 pb-2 uppercase tracking-wide">
                    5. Metode Pembayaran
                  </label>
                  <TerminalPicker
                    terminals={terminals}
                    value={payment ?? { terminalId: "", category: "qris" }}
                    onChange={setPayment}
                    disabled={isSubmitting || !isSessionOpen}
                    name="manual-entry-terminal"
                    excludeCash
                  />
                </div>

                <div className="flex justify-between items-center p-4 bg-orange-50 border border-orange-100 rounded-xl">
                  <span className="text-black text-sm font-bold uppercase tracking-wider">Total Tagihan</span>
                  <span className="text-2xl font-black text-[#fb9418]">{formatCurrency(totalPrice)}</span>
                </div>
              </>
            )}

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r shadow-sm">{formError}</div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-gray-200 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 hover:text-black rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !targetSession || !isSessionOpen}
              className="px-6 py-2.5 text-sm font-bold text-[#fcfcfc] bg-[#fb9418] hover:bg-orange-500 rounded-lg shadow-md transition-all active:scale-95 flex items-center justify-center min-w-[140px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Memproses..." : "Buat Tiket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryModal;