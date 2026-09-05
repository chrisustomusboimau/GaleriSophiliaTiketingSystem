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
 */

import React, { useEffect, useMemo, useState } from "react";
import { getData } from "country-list";
import { apiGet, apiPost, ApiError } from "../../api/client";
import { OperationalSession, TicketMaster, TransactionEntry, PaymentMethod } from "../../types";
import { formatCurrency, getMasterColorTheme, buildSubCategoryMasterMap } from "../../utils/formatters";

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

const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ isOpen, onClose, onSuccess, sessionId }) => {
  const [targetSession, setTargetSession] = useState<OperationalSession | null>(null);
  const [masterNameMap, setMasterNameMap] = useState<Record<string, string>>({});
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("qris");
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitor[]>([{ countryCode: "id", count: 1 }]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // --- Ambil sesi TUJUAN (bukan sesi aktif global) + master data setiap
  // kali modal dibuka ---
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoadingSession(true);
      setSessionError(null);
      setTargetSession(null);
      try {
        const [session, masters] = await Promise.all([
          apiGet<OperationalSession>(`/sessions/${sessionId}`),
          apiGet<TicketMaster[]>("/ticket-masters"),
        ]);
        setTargetSession(session);
        setMasterNameMap(buildSubCategoryMasterMap(masters));
        const initialQty: Record<string, number> = {};
        session.active_tickets.forEach((st) => {
          initialQty[st.ticket_sub_category_id] = 0;
        });
        setQuantities(initialQty);
      } catch (err) {
        setSessionError(err instanceof ApiError ? err.message : "Gagal memuat data sesi.");
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadData();
  }, [isOpen, sessionId]);

  const isSessionOpen = targetSession?.status === "opened";

  // --- Grouping tiket aktif per master ---
  const groupedTickets = useMemo(() => {
    if (!targetSession) return [];
    const groups = new Map<string, { masterName: string; items: { id: string; name: string; price: number }[] }>();
    targetSession.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      const masterKey = masterNameMap[sub.id] || "Tiket";
      if (!groups.has(masterKey)) groups.set(masterKey, { masterName: masterKey, items: [] });
      groups.get(masterKey)!.items.push({ id: sub.id, name: sub.name, price: sub.price });
    });
    return Array.from(groups.values());
  }, [targetSession, masterNameMap]);

  const totalPeople = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + (Number(q) || 0), 0),
    [quantities]
  );

  const totalFromCountries = useMemo(
    () => countryVisitors.reduce((sum, c) => sum + (parseInt(c.count as string, 10) || 0), 0),
    [countryVisitors]
  );

  const totalPrice = useMemo(() => {
    if (!targetSession) return 0;
    let total = 0;
    targetSession.active_tickets.forEach((st) => {
      const sub = st.sub_category;
      if (!sub) return;
      total += (quantities[st.ticket_sub_category_id] || 0) * sub.price;
    });
    return total;
  }, [targetSession, quantities]);

  if (!isOpen) return null;

  // --- Handlers ---
  const adjustQuantity = (subCategoryId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [subCategoryId]: Math.max(0, (prev[subCategoryId] || 0) + delta),
    }));
  };

  const handleQuantityInput = (subCategoryId: string, value: string) => {
    const parsed = Math.max(0, parseInt(value, 10) || 0);
    setQuantities((prev) => ({ ...prev, [subCategoryId]: parsed }));
  };

  const handleAddCountry = () => setCountryVisitors((prev) => [...prev, { countryCode: "id", count: "" }]);

  const handleUpdateCountry = (index: number, key: keyof CountryVisitor, value: string) => {
    setCountryVisitors((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  };

  const handleRemoveCountry = (index: number) => setCountryVisitors((prev) => prev.filter((_, i) => i !== index));

  const handleClose = () => {
    setCustomerName("");
    setQuantities({});
    setCountryVisitors([{ countryCode: "id", count: 1 }]);
    setPaymentMethod("qris");
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

    if (totalPeople === 0) {
      setFormError("Silakan masukkan setidaknya 1 tiket.");
      return;
    }

    if (totalPeople !== totalFromCountries) {
      setFormError(
        `Jumlah total tiket (${totalPeople}) tidak sama dengan total pengunjung dari daftar asal negara (${totalFromCountries}).`
      );
      return;
    }

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticket_sub_category_id, quantity]) => ({ ticket_sub_category_id, quantity }));

    const origins = countryVisitors.map((c) => ({
      country_code: c.countryCode,
      count: Math.max(0, parseInt(c.count as string, 10) || 0),
    }));

    setIsSubmitting(true);
    try {
      const transaction = await apiPost<TransactionEntry>("/transactions", {
        customer_name: customerName.trim(),
        payment_method: paymentMethod,
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

                {/* 2. TIKET */}
                <div>
                  <label className="block text-sm font-extrabold text-black mb-3 border-b border-gray-200 pb-2 uppercase tracking-wide">
                    2. Pilih Tiket ({targetSession.name})
                  </label>
                  <div className="space-y-4">
                    {groupedTickets.map((group) => {
                      const theme = getMasterColorTheme(group.masterName);
                      return (
                        <div key={group.masterName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                          <div className={`px-3 py-2 text-xs font-bold border-b uppercase tracking-wide ${theme}`}>
                            {group.masterName}
                          </div>
                          <div className="p-3 space-y-2">
                            {group.items.map((item) => (
                              <div key={item.id} className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-bold text-gray-800">{item.name}</p>
                                  <p className="text-xs text-gray-400">{formatCurrency(item.price)} / orang</p>
                                </div>
                                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => adjustQuantity(item.id, -1)}
                                    disabled={isSubmitting || !isSessionOpen || (quantities[item.id] || 0) <= 0}
                                    className="w-8 h-8 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={quantities[item.id] ?? 0}
                                    onChange={(e) => handleQuantityInput(item.id, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    disabled={isSubmitting || !isSessionOpen}
                                    className="w-12 h-8 text-center font-bold text-black border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-[#fb9418] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => adjustQuantity(item.id, 1)}
                                    disabled={isSubmitting || !isSessionOpen}
                                    className="w-8 h-8 flex items-center justify-center font-bold text-[#fb9418] hover:bg-orange-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {groupedTickets.length === 0 && (
                      <p className="text-gray-400 italic text-sm text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                        Sesi ini belum memiliki tiket aktif.
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. ASAL NEGARA */}
                <div>
                  <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                    <label className="block text-sm font-extrabold text-black uppercase tracking-wide">3. Asal Negara</label>
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

                {/* 4. METODE PEMBAYARAN */}
                <div>
                  <label className="block text-sm font-extrabold text-black mb-3 border-b border-gray-200 pb-2 uppercase tracking-wide">
                    4. Metode Pembayaran
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["qris", "card", "cash"] as PaymentMethod[]).map((method) => (
                      <label
                        key={method}
                        className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all text-center leading-tight text-xs sm:text-sm ${
                          paymentMethod === method
                            ? "border-[#fb9418] bg-orange-50 text-[#fb9418] font-bold shadow-sm"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method}
                          checked={paymentMethod === method}
                          onChange={() => setPaymentMethod(method)}
                          className="hidden"
                          disabled={isSubmitting || !isSessionOpen}
                        />
                        {method === "qris" ? "QRIS" : method === "card" ? "Kartu Kredit/Debit" : "Tunai"}
                      </label>
                    ))}
                  </div>
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
