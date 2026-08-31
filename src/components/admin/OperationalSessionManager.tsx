/**
 * OperationalSessionManager.tsx (src/components/admin) — KOMPONEN BARU
 * ----------------------------------------------------
 * Admin menjadwalkan sesi operasional (nama, tanggal, jam, varian tiket
 * yang aktif dijual), lalu mengisi nomor awal & membuka/menutup sesi.
 * Kasir mengoperasikan sesi yang SUDAH dibuka: bisa mengisi/mengedit
 * nomor tiket fisik awal & akhir kapan saja selama sesi masih Open.
 *
 * RBAC (per revisi):
 * - Melihat sesi: Admin melihat SEMUA status (draft/opened/closed).
 *   Kasir & checker HANYA melihat sesi berstatus 'opened' — sesi draft
 *   & closed tidak ditampilkan sama sekali ke mereka.
 * - Membuat sesi: admin saja.
 * - Buka (Open) & Tutup (Close) sesi: ADMIN SAJA (kasir tidak lagi bisa).
 * - Isi/edit nomor tiket awal & akhir: admin & kasir, kapan saja selama
 *   status sesi 'opened' (tidak lagi terkunci setelah diisi sekali).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPatch, ApiError } from "../../api/client";
import {
  OperationalSession,
  OperationalSessionPayload,
  TicketMaster,
  UserRole,
  flattenTicketMasters,
} from "../../types";
import {
  formatDateID,
  toApiTime,
  toTimeInputValue,
  SESSION_STATUS_LABEL,
  SESSION_STATUS_BADGE,
  SESSION_LIVE_LABEL,
  SESSION_LIVE_BADGE,
} from "../../utils/formatters";
import SessionAuditForm from "./SessionAuditForm";

interface OperationalSessionManagerProps {
  role: UserRole | null;
  /** Dipanggil saat user menekan "Ke Detail Sesi" — biasanya `navigate('/sesi/' + id)`. */
  onGoToDetail: (sessionId: string) => void;
}

const emptyForm = { name: "", date: "", start_time: "", end_time: "", ticket_sub_category_ids: [] as string[] };

const OperationalSessionManager: React.FC<OperationalSessionManagerProps> = ({ role, onGoToDetail }) => {
  const isAdmin = role === "admin";
  /** Buka & Tutup sesi: admin saja. */
  const canManageSession = role === "admin";
  /** Isi/edit nomor tiket fisik awal & akhir: admin & kasir. */
  const canEditAudit = role === "admin" || role === "kasir";

  const [sessions, setSessions] = useState<OperationalSession[]>([]);
  const [catalog, setCatalog] = useState<TicketMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [detailSession, setDetailSession] = useState<OperationalSession | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (dateFilter) params.set("date", dateFilter);
      // Kasir & checker tidak boleh melihat sesi draft/closed sama sekali —
      // paksa query ke status=opened untuk mereka, apapun isi statusFilter.
      if (isAdmin) {
        if (statusFilter) params.set("status", statusFilter);
      } else {
        params.set("status", "opened");
      }
      const qs = params.toString();
      const data = await apiGet<OperationalSession[]>(`/sessions${qs ? `?${qs}` : ""}`);
      // Jaring pengaman tambahan di client, seandainya backend suatu saat
      // berubah/tidak menghormati query status di atas.
      setSessions(isAdmin ? data : data.filter((s) => s.status === "opened"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat sesi operasional.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, statusFilter, isAdmin]);

  const loadCatalog = useCallback(async () => {
    try {
      const data = await apiGet<TicketMaster[]>("/ticket-masters");
      setCatalog(data);
    } catch {
      // Non-blocking; form pemilihan tiket hanya tidak akan muncul.
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const flatCatalog = useMemo(() => flattenTicketMasters(catalog), [catalog]);
  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, typeof flatCatalog>();
    flatCatalog.forEach((sc) => {
      if (!groups.has(sc.master_name)) groups.set(sc.master_name, []);
      groups.get(sc.master_name)!.push(sc);
    });
    return Array.from(groups.entries());
  }, [flatCatalog]);

  // --- Create session ---
  const openCreateModal = () => {
    setCreateForm(emptyForm);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const toggleSubCategory = (id: string) => {
    setCreateForm((prev) => ({
      ...prev,
      ticket_sub_category_ids: prev.ticket_sub_category_ids.includes(id)
        ? prev.ticket_sub_category_ids.filter((x) => x !== id)
        : [...prev.ticket_sub_category_ids, id],
    }));
  };

  /**
   * Pemeriksaan tumpang-tindih di sisi klien — HANYA untuk umpan balik
   * cepat. Gerbang sebenarnya tetap di backend
   * (`_assert_no_session_overlap` di api/app/app.py), karena daftar sesi
   * di layar ini bisa saja terfilter tanggal/status atau sudah basi.
   *
   * Aturannya identik dengan backend: dua rentang bertabrakan hanya kalau
   * benar-benar beririsan (half-open), jadi jadwal bersambung persis
   * seperti 12:00–16:00 lalu 16:00–20:00 tidak dianggap bentrok.
   */
  const findLocalOverlap = (date: string, start: string, end: string) =>
    sessions.find(
      (s) =>
        s.date === date &&
        toTimeInputValue(s.start_time) < end &&
        toTimeInputValue(s.end_time) > start
    );

  const handleCreateSession = async () => {
    if (!createForm.name.trim() || !createForm.date || !createForm.start_time || !createForm.end_time) {
      setCreateError("Nama, tanggal, jam mulai, dan jam selesai wajib diisi.");
      return;
    }
    if (createForm.end_time <= createForm.start_time) {
      setCreateError("Jam selesai harus lebih besar dari jam mulai.");
      return;
    }
    if (createForm.ticket_sub_category_ids.length === 0) {
      setCreateError("Pilih setidaknya satu varian tiket yang dijual pada sesi ini.");
      return;
    }
    const clash = findLocalOverlap(createForm.date, createForm.start_time, createForm.end_time);
    if (clash) {
      setCreateError(
        `Jadwal bertabrakan dengan sesi "${clash.name}" ` +
          `(${toTimeInputValue(clash.start_time)}–${toTimeInputValue(clash.end_time)}) pada tanggal yang sama.`
      );
      return;
    }
    const payload: OperationalSessionPayload = {
      name: createForm.name.trim(),
      date: createForm.date,
      start_time: toApiTime(createForm.start_time),
      end_time: toApiTime(createForm.end_time),
      ticket_sub_category_ids: createForm.ticket_sub_category_ids,
    };
    try {
      setCreateSaving(true);
      setCreateError(null);
      await apiPost("/sessions", payload);
      setIsCreateOpen(false);
      await loadSessions();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Gagal membuat sesi.");
    } finally {
      setCreateSaving(false);
    }
  };

  // --- Detail / audit ---
  const openDetail = async (session: OperationalSession) => {
    setDetailError(null);
    try {
      const fresh = await apiGet<OperationalSession>(`/sessions/${session.id}`);
      setDetailSession(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat detail sesi.");
    }
  };

  const closeDetail = () => {
    setDetailSession(null);
    loadSessions();
  };

  const handleOpenSession = async () => {
    if (!detailSession) return;
    try {
      setStatusSaving(true);
      setDetailError(null);
      const updated = await apiPatch<OperationalSession>(`/sessions/${detailSession.id}/open`);
      setDetailSession(updated);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Gagal membuka sesi.");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleCloseSession = async () => {
    if (!detailSession) return;
    try {
      setStatusSaving(true);
      setDetailError(null);
      const updated = await apiPatch<OperationalSession>(`/sessions/${detailSession.id}/close`);
      setDetailSession(updated);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Gagal menutup sesi.");
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto text-black">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h3 className="font-bold text-lg text-black uppercase tracking-wide">Sesi Operasional</h3>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin
              ? "Jadwalkan sesi penjualan & kelola audit tiket fisik."
              : "Menampilkan sesi yang sedang dibuka (Open) saja."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="text-sm font-bold px-4 py-2.5 bg-black text-[#fb9418] rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-2 active:scale-95 self-start sm:self-auto"
          >
            <span className="text-lg leading-none">+</span> Sesi Baru
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="text-sm font-bold text-black border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-[#fb9418]"
        />
        {/* Filter status hanya relevan untuk admin — kasir/checker sudah
            dipaksa hanya melihat sesi 'opened', jadi dropdown ini tidak
            berguna (dan berpotensi membingungkan) untuk mereka. */}
        {isAdmin && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm font-bold text-black border border-gray-300 rounded-lg px-3 py-2 bg-white shadow-sm outline-none focus:ring-2 focus:ring-[#fb9418] cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="draft">Draft</option>
            <option value="opened">Dibuka</option>
            <option value="closed">Ditutup</option>
          </select>
        )}
        {(dateFilter || (isAdmin && statusFilter)) && (
          <button
            onClick={() => {
              setDateFilter("");
              setStatusFilter("");
            }}
            className="text-xs text-gray-400 hover:text-red-500 font-bold underline underline-offset-2"
          >
            Reset Filter
          </button>
        )}
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">{error}</div>}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 font-medium">Memuat sesi...</div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          Tidak ada sesi yang cocok dengan filter.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
              <tr>
                <th className="px-4 py-3 text-left">Nama Sesi</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Jam</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Tiket Aktif</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-bold text-black">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDateID(s.date)}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">
                    {toTimeInputValue(s.start_time)} - {toTimeInputValue(s.end_time)}
                  </td>
                  <td className="px-4 py-3">
                    {/* Dua badge terpisah dan sengaja tidak digabung:
                        "Dibuka" itu STATUS (admin sudah membukanya), sedang
                        "Berlangsung" itu WAKTU (jam sekarang ada di dalam
                        rentang sesi). Sesi bisa Dibuka tapi jadwalnya baru
                        mulai nanti — hanya yang Berlangsung yang melayani
                        pembelian pengunjung. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${SESSION_STATUS_BADGE[s.status]}`}>
                        {SESSION_STATUS_LABEL[s.status]}
                      </span>
                      {s.is_live && (
                        <span className={`text-[11px] px-2 py-1 rounded-full border ${SESSION_LIVE_BADGE}`}>
                          ● {SESSION_LIVE_LABEL}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.active_tickets.length}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button onClick={() => openDetail(s)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-[#fb9418] hover:text-[#fb9418]">
                        Detail / Audit
                      </button>
                      {s.status !== "draft" && (
                        <button
                          onClick={() => onGoToDetail(s.id)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-black text-[#fb9418] hover:bg-zinc-800"
                        >
                          Ke Detail Sesi
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL CREATE */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">Sesi Operasional Baru</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {createError && <div className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{createError}</div>}

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Nama Sesi</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder='Contoh: "Sesi Siang"'
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Tanggal</label>
                <input
                  type="date"
                  value={createForm.date}
                  onChange={(e) => setCreateForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Jam Mulai</label>
                  <input
                    type="time"
                    value={createForm.start_time}
                    onChange={(e) => setCreateForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Jam Selesai</label>
                  <input
                    type="time"
                    value={createForm.end_time}
                    onChange={(e) => setCreateForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2">Tiket yang Dijual</label>
                <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {groupedCatalog.map(([masterName, items]) => (
                    <div key={masterName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide bg-gray-50 border-b border-gray-200">{masterName}</div>
                      <div className="p-2">
                        {items.map((sc) => (
                          <label key={sc.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-orange-50/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createForm.ticket_sub_category_ids.includes(sc.id)}
                              onChange={() => toggleSubCategory(sc.id)}
                              className="w-4 h-4 text-[#fb9418] border-gray-300 rounded focus:ring-[#fb9418]"
                            />
                            <span className="text-sm text-black font-medium">{sc.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedCatalog.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Belum ada master tiket. Buat master tiket terlebih dahulu.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsCreateOpen(false)} className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg">
                Batal
              </button>
              <button
                onClick={handleCreateSession}
                disabled={createSaving}
                className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50"
              >
                {createSaving ? "Menyimpan..." : "Buat Sesi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL / AUDIT */}
      {detailSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
            <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">{detailSession.name}</h3>
                <p className="text-[11px] text-gray-400 font-mono mt-1">
                  {formatDateID(detailSession.date)} · {toTimeInputValue(detailSession.start_time)}–{toTimeInputValue(detailSession.end_time)}
                </p>
              </div>
              <button onClick={closeDetail} className="text-gray-400 hover:text-white text-2xl font-bold px-2">
                ✕
              </button>
            </header>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${SESSION_STATUS_BADGE[detailSession.status]}`}>
                  {SESSION_STATUS_LABEL[detailSession.status]}
                </span>
                {detailSession.is_live && (
                  <span className={`text-xs px-3 py-1.5 rounded-full border ${SESSION_LIVE_BADGE}`}>
                    ● {SESSION_LIVE_LABEL}
                  </span>
                )}
                {canManageSession && detailSession.status === "draft" && (
                  <button
                    onClick={handleOpenSession}
                    disabled={statusSaving}
                    className="text-xs font-bold px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Buka Sesi
                  </button>
                )}
                {canManageSession && detailSession.status === "opened" && (
                  <button
                    onClick={handleCloseSession}
                    disabled={statusSaving}
                    className="text-xs font-bold px-4 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Tutup Sesi
                  </button>
                )}
                {/* Muncul begitu sesi tidak lagi 'draft' — termasuk tepat setelah
                    "Buka Sesi" ditekan di atas, sesuai alur yang diminta. */}
                {detailSession.status !== "draft" && (
                  <button
                    onClick={() => onGoToDetail(detailSession.id)}
                    className="text-xs font-bold px-4 py-1.5 rounded-lg bg-[#fb9418] text-white hover:bg-orange-500 shadow-sm flex items-center gap-1.5"
                  >
                    Ke Detail Sesi
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </div>

              {detailError && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{detailError}</div>}

              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Audit Tiket Fisik</p>
              <SessionAuditForm session={detailSession} canEdit={canEditAudit} onSaved={(updated) => setDetailSession(updated)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationalSessionManager;
