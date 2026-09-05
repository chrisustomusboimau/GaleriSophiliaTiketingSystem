/**
 * EditTransactionModal.tsx (src/components/admin)
 * ----------------------------------------------------
 * Modal edit transaksi: nama pemesan, status, metode pembayaran,
 * rincian tiket (berbasis Master Data, bukan lantai hardcoded),
 * serta asal negara pengunjung.
 */

import React, { useEffect, useMemo, useState } from "react";
import { getData } from "country-list";
import { apiGet, ApiError } from "../../api/client";
import {
  TicketMaster,
  TransactionEntry,
  TransactionStatus,
  PaymentMethod,
  flattenTicketMasters,
  FlatSubCategory,
} from "../../types";
import { formatCurrency, calculateItemsTotal, getMasterColorTheme } from "../../utils/formatters";

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionEntry | null;
  onSave: (
    id: string,
    updatedData: {
      customer_name?: string | null;
      items?: { ticket_sub_category_id: string; quantity: number }[];
      origins?: { country_code: string; count: number }[];
      status?: TransactionStatus;
      payment_method?: PaymentMethod;
    }
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  /** true jika user login tidak berhak menghapus (mis. role kasir) */
  canDelete?: boolean;
}

const COUNTRIES = Object.freeze(getData().map((c) => ({ code: c.code.toLowerCase(), name: c.name })));

interface CountryVisitorState {
  countryCode: string;
  count: number | string;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onSave,
  onDelete,
  canDelete = true,
}) => {
  const [catalog, setCatalog] = useState<FlatSubCategory[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [countryVisitors, setCountryVisitors] = useState<CountryVisitorState[]>([{ countryCode: "id", count: 1 }]);
  const [editedStatus, setEditedStatus] = useState<TransactionStatus>("pending");
  const [editedPaymentMethod, setEditedPaymentMethod] = useState<PaymentMethod>("qris");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Muat katalog master data setiap kali modal dibuka ---
  useEffect(() => {
    if (!isOpen) return;
    const loadCatalog = async () => {
      setIsLoadingCatalog(true);
      try {
        const masters = await apiGet<TicketMaster[]>("/ticket-masters");
        setCatalog(flattenTicketMasters(masters));
      } catch {
        setError("Gagal memuat master data tiket.");
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    loadCatalog();
  }, [isOpen]);

  // --- Inisialisasi form dari data transaksi ---
  useEffect(() => {
    if (transaction && isOpen) {
      setCustomerName(transaction.customer_name || "");

      const initialQty: Record<string, number> = {};
      transaction.items.forEach((item) => {
        initialQty[item.ticket_sub_category_id] = (initialQty[item.ticket_sub_category_id] || 0) + item.quantity;
      });
      setQuantities(initialQty);

      if (transaction.origins && transaction.origins.length > 0) {
        setCountryVisitors(transaction.origins.map((o) => ({ countryCode: o.country_code, count: o.count })));
      } else {
        const total = transaction.items.reduce((s, i) => s + i.quantity, 0);
        setCountryVisitors([{ countryCode: "id", count: total > 0 ? total : 1 }]);
      }

      setEditedStatus(transaction.status);
      setEditedPaymentMethod(transaction.payment_method || "qris");
      setError(null);
    }
  }, [transaction, isOpen]);

  // --- Group katalog per master, sertakan varian yang sudah dipesan meski
  //     seandainya sesi lama sudah tidak aktif ---
  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, FlatSubCategory[]>();
    catalog.forEach((sc) => {
      if (!groups.has(sc.master_name)) groups.set(sc.master_name, []);
      groups.get(sc.master_name)!.push(sc);
    });
    return Array.from(groups.entries()).map(([masterName, items]) => ({ masterName, items }));
  }, [catalog]);

  const items = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([ticket_sub_category_id, quantity]) => ({ ticket_sub_category_id, quantity })),
    [quantities]
  );

  const totalPeople = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  const totalFromCountries = useMemo(
    () => countryVisitors.reduce((sum, c) => sum + Math.max(0, parseInt(c.count as string, 10) || 0), 0),
    [countryVisitors]
  );

  const newTotalPrice = useMemo(() => calculateItemsTotal(items, catalog), [items, catalog]);

  // --- Handlers ---
  const adjustQuantity = (subCategoryId: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [subCategoryId]: Math.max(0, (prev[subCategoryId] || 0) + delta) }));
  };

  const handleQuantityInput = (subCategoryId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [subCategoryId]: Math.max(0, parseInt(value, 10) || 0) }));
  };

  const handleAddCountry = () => setCountryVisitors((prev) => [...prev, { countryCode: "id", count: "" }]);
  const handleUpdateCountry = (index: number, key: keyof CountryVisitorState, value: string) =>
    setCountryVisitors((prev) => prev.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  const handleRemoveCountry = (index: number) => setCountryVisitors((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!transaction) return;

    if (!customerName.trim()) {
      setError("Nama pemesan wajib diisi.");
      return;
    }

    if (totalPeople === 0 && editedStatus !== "cancelled") {
      setError("Jumlah tiket tidak boleh 0. Hapus transaksi atau ubah status ke Cancelled.");
      return;
    }

    if (totalPeople !== totalFromCountries && editedStatus !== "cancelled") {
      setError(
        `Jumlah total tiket (${totalPeople}) tidak sama dengan total pengunjung dari daftar asal negara (${totalFromCountries}).`
      );
      return;
    }

    const payloadOrigins = countryVisitors.map((c) => ({
      country_code: c.countryCode,
      count: Math.max(0, parseInt(c.count as string, 10) || 0),
    }));

    try {
      setIsSaving(true);
      setError(null);
      await onSave(transaction.id, {
        customer_name: customerName.trim(),
        items,
        origins: payloadOrigins,
        status: editedStatus,
        payment_method: editedPaymentMethod,
      });
      onClose();
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : err?.message || "Gagal menyimpan perubahan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction) return;
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus tiket ${transaction.ticket_code} secara permanen?`
    );
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      setError(null);
      await onDelete(transaction.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Gagal menghapus transaksi.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] border border-gray-200">
        <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Edit Transaksi</h3>
            <p className="text-[11px] text-gray-400 font-mono mt-1">
              Kode: <span className="font-bold text-[#fb9418] text-sm">{transaction.ticket_code}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-2xl px-2 transition-colors">
            ✕
          </button>
        </header>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r shadow-sm flex items-start gap-2">
              <span className="font-bold mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* NAMA PEMESAN */}
          <div className="mb-6">
            <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Nama Pemesan</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isSaving}
              required
              placeholder="Nama pengunjung"
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
            />
          </div>

          {/* STATUS & METODE PEMBAYARAN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Status Pembayaran</label>
              <select
                value={editedStatus}
                onChange={(e) => setEditedStatus(e.target.value as TransactionStatus)}
                disabled={isSaving}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white font-bold text-gray-800 shadow-sm cursor-pointer text-sm"
              >
                <option value="pending">🟡 Pending</option>
                <option value="confirmed">🟢 Confirmed</option>
                <option value="cancelled">🔴 Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Metode Pembayaran</label>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm h-[42px] bg-white">
                {(["qris", "card", "cash"] as PaymentMethod[]).map((method) => (
                  <label
                    key={method}
                    className={`flex-1 flex items-center justify-center text-xs font-bold cursor-pointer transition-colors ${
                      editedPaymentMethod === method ? "bg-[#fb9418] text-white" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="editPaymentMethod"
                      value={method}
                      checked={editedPaymentMethod === method}
                      onChange={(e) => setEditedPaymentMethod(e.target.value as PaymentMethod)}
                      className="hidden"
                      disabled={isSaving}
                    />
                    {method === "qris" ? "QRIS" : method === "card" ? "KARTU" : "TUNAI"}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <hr className="mb-6 border-gray-200" />

          {/* RINCIAN TIKET */}
          <div className="mb-6">
            <label className="block text-sm font-extrabold text-black uppercase tracking-wide mb-3">Rincian Tiket</label>
            {isLoadingCatalog && <p className="text-sm text-gray-400">Memuat master data...</p>}
            <div className="space-y-4">
              {groupedCatalog.map((group) => {
                const theme = getMasterColorTheme(group.masterName);
                return (
                  <div key={group.masterName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className={`px-3 py-2 text-xs font-bold border-b uppercase tracking-wide ${theme}`}>{group.masterName}</div>
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
                              disabled={isSaving || (quantities[item.id] || 0) <= 0}
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
                              disabled={isSaving}
                              className="w-12 h-8 text-center font-bold text-black border-x border-gray-300 outline-none focus:ring-2 focus:ring-inset focus:ring-[#fb9418] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => adjustQuantity(item.id, 1)}
                              disabled={isSaving}
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
            </div>
          </div>

          {/* ASAL NEGARA */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-extrabold text-black uppercase tracking-wide">Asal Negara</label>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full border ${
                  totalPeople !== totalFromCountries ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-700 border-green-200"
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
                    disabled={isSaving}
                    className="flex-[3] min-w-0 p-2 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] text-sm text-black truncate transition-shadow cursor-pointer"
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
                    disabled={isSaving}
                    placeholder="0"
                    className="flex-1 min-w-0 p-2 text-center font-bold text-black bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none transition-shadow"
                  />

                  {countryVisitors.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveCountry(index)}
                      disabled={isSaving}
                      className="flex-none w-8 h-8 flex items-center justify-center font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
                disabled={isSaving}
                className="mt-3 text-sm font-bold text-[#fb9418] hover:text-orange-600 transition-colors flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span> Tambah Negara
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border-t p-5 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-5 p-4 bg-orange-50 border border-orange-100 rounded-xl">
            <div>
              <span className="text-black text-sm font-bold uppercase tracking-wider block">Total Tagihan Baru</span>
              <span className="text-[10px] text-gray-500 font-mono">(Dihitung otomatis dari Master Data)</span>
            </div>
            <span className={`text-3xl font-black ${newTotalPrice !== transaction.total_price ? "text-[#fb9418]" : "text-black"}`}>
              {formatCurrency(newTotalPrice)}
            </span>
          </div>

          <div className="flex gap-3">
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="px-4 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-200"
              >
                {isDeleting ? "Menghapus..." : "Hapus Tiket"}
              </button>
            )}
            <div className="flex-1 flex gap-3 justify-end">
              <button
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="px-5 py-3 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-black font-bold rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isDeleting}
                className="px-6 py-3 bg-[#fb9418] text-[#fcfcfc] hover:bg-orange-500 font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTransactionModal;
