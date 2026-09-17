/**
 * src/components/admin/SessionAuditForm.tsx — BARU
 * ----------------------------------------------------
 * Form input nomor tiket fisik (awal & akhir) untuk seluruh tiket aktif
 * dalam satu sesi, dengan SATU tombol "Simpan" yang mengirim semua
 * perubahan sekaligus ke `PATCH /sessions/{id}/audit/bulk` — satu
 * transaksi database di backend (semua berhasil bersama, atau tidak ada
 * yang tersimpan sama sekali kalau salah satu tidak valid).
 *
 * Dipakai di DUA tempat:
 * 1. `OperationalSessionManager.tsx` — modal "Detail / Audit" di daftar sesi.
 * 2. `SessionDetailPage.tsx` — gerbang wajib isi nomor awal untuk kasir
 *    sebelum bisa mengakses tab Antrian/Riwayat/Ringkasan.
 *
 * Nomor awal & akhir BOLEH diisi/diedit kapan saja selama sesi induknya
 * berstatus 'opened' (nomor awal juga boleh saat 'draft') — tidak
 * terkunci lagi setelah 1x disimpan seperti versi sebelumnya.
 */

import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, ApiError } from "../../api/client";
import { OperationalSession, TicketMaster, SessionTicketAuditBulkItem } from "../../types";
import { buildSubCategoryMasterMap, getMasterColorTheme } from "../../utils/formatters";

interface SessionAuditFormProps {
  session: OperationalSession;
  /** Admin & kasir true; checker (atau non-staf) false → form read-only, tombol Simpan disembunyikan. */
  canEdit: boolean;
  onSaved: (updatedSession: OperationalSession) => void;
  submitLabel?: string;
}

type FieldValues = Record<string, { start: string; end: string }>;

const buildInitialValues = (session: OperationalSession): FieldValues => {
  const initial: FieldValues = {};
  session.active_tickets.forEach((st) => {
    initial[st.id] = {
      start: st.audit?.start_ticket_number != null ? String(st.audit.start_ticket_number) : "",
      end: st.audit?.end_ticket_number != null ? String(st.audit.end_ticket_number) : "",
    };
  });
  return initial;
};

const SessionAuditForm: React.FC<SessionAuditFormProps> = ({ session, canEdit, onSaved, submitLabel = "Simpan Semua Perubahan" }) => {
  const [values, setValues] = useState<FieldValues>(() => buildInitialValues(session));
  const [initialValues, setInitialValues] = useState<FieldValues>(() => buildInitialValues(session));
  const [masterNameMap, setMasterNameMap] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sinkronkan ulang setiap kali data sesi (dari parent) berubah — misalnya
  // setelah bulk-save berhasil dan parent menerima session terbaru.
  useEffect(() => {
    const fresh = buildInitialValues(session);
    setValues(fresh);
    setInitialValues(fresh);
    setError(null);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    apiGet<TicketMaster[]>("/ticket-masters")
      .then((masters) => {
        if (!cancelled) setMasterNameMap(buildSubCategoryMasterMap(masters));
      })
      .catch(() => {
        // Non-blocking — label master induk cukup ditinggalkan kosong kalau gagal.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canEditStart = canEdit && (session.status === "draft" || session.status === "opened");
  const canEditEnd = canEdit && session.status === "opened";

  const isDirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initialValues), [values, initialValues]);

  const groupedTickets = useMemo(() => {
    const groups = new Map<string, typeof session.active_tickets>();
    session.active_tickets.forEach((st) => {
      const masterName = st.sub_category ? masterNameMap[st.sub_category.id] || "Tiket" : "Tiket";
      if (!groups.has(masterName)) groups.set(masterName, []);
      groups.get(masterName)!.push(st);
    });
    return Array.from(groups.entries());
  }, [session, masterNameMap]);

  const updateField = (ticketId: string, field: "start" | "end", value: string) => {
    setValues((prev) => ({ ...prev, [ticketId]: { ...prev[ticketId], [field]: value } }));
  };

  const handleSave = async () => {
    setError(null);

    const items: SessionTicketAuditBulkItem[] = [];
    for (const st of session.active_tickets) {
      const cur = values[st.id] || { start: "", end: "" };
      const orig = initialValues[st.id] || { start: "", end: "" };
      const item: SessionTicketAuditBulkItem = { session_ticket_id: st.id };
      let changed = false;

      if (cur.start !== orig.start && cur.start.trim() !== "") {
        item.start_ticket_number = Math.max(0, parseInt(cur.start, 10) || 0);
        changed = true;
      }
      if (cur.end !== orig.end && cur.end.trim() !== "") {
        item.end_ticket_number = Math.max(0, parseInt(cur.end, 10) || 0);
        changed = true;
      }
      if (changed) items.push(item);
    }

    if (items.length === 0) {
      setError("Tidak ada perubahan untuk disimpan.");
      return;
    }

    // Validasi ringan di client (backend tetap memvalidasi ulang sebagai jaring pengaman utama).
    for (const item of items) {
      const st = session.active_tickets.find((s) => s.id === item.session_ticket_id);
      const label = st?.sub_category?.name || "salah satu tiket";
      if (item.end_ticket_number !== undefined) {
        const effectiveStart = item.start_ticket_number ?? st?.audit?.start_ticket_number ?? undefined;
        if (effectiveStart === undefined || effectiveStart === null) {
          setError(`Nomor awal untuk "${label}" harus diisi terlebih dahulu.`);
          return;
        }
        if (item.end_ticket_number < effectiveStart) {
          setError(`Nomor akhir untuk "${label}" tidak boleh lebih kecil dari nomor awal.`);
          return;
        }
      }
    }

    try {
      setIsSaving(true);
      const updated = await apiPatch<OperationalSession>(`/sessions/${session.id}/audit/bulk`, { items });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan nomor tiket.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">{error}</div>}

      <div className="space-y-3">
        {groupedTickets.map(([masterName, tickets]) => {
          const theme = getMasterColorTheme(masterName);
          return (
            <div key={masterName} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div className={`px-3 py-2 text-xs font-bold border-b uppercase tracking-wide ${theme}`}>{masterName}</div>
              <div className="p-3 space-y-3">
                {tickets.map((st) => (
                  <div key={st.id} className="border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <p className="text-sm font-bold text-black mb-2">{st.sub_category?.name || "Varian tiket"}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">No. Tiket Awal</label>
                        <input
                          type="number"
                          min={0}
                          value={values[st.id]?.start ?? ""}
                          onChange={(e) => updateField(st.id, "start", e.target.value)}
                          disabled={!canEditStart}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-black disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-[#fb9418] outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">No. Tiket Akhir</label>
                        <input
                          type="number"
                          min={0}
                          value={values[st.id]?.end ?? ""}
                          onChange={(e) => updateField(st.id, "end", e.target.value)}
                          disabled={!canEditEnd}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-black disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-[#fb9418] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {groupedTickets.length === 0 && (
          <p className="text-sm text-gray-400 italic text-center py-6">Sesi ini tidak memiliki tiket aktif.</p>
        )}
      </div>

      {canEdit && groupedTickets.length > 0 && (
        <button
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="mt-4 w-full px-4 py-3 text-sm font-bold bg-[#fb9418] text-white rounded-lg hover:bg-orange-500 shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Menyimpan..." : submitLabel}
        </button>
      )}
    </div>
  );
};

export default SessionAuditForm;
