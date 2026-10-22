/**
 * SessionEditModal.tsx (src/components/admin) — KOMPONEN BARU
 * ----------------------------------------------------
 * Modal untuk mengubah nama / tanggal / jam sebuah sesi operasional.
 *
 * - PRE-FILLED: form diisi dari `session` lewat initializer `useState`.
 *   Pemanggil WAJIB memberi `key={session.id}` supaya form dibuat ulang
 *   (bukan dipakai ulang dengan data sesi sebelumnya) tiap sesi berbeda.
 * - PARTIAL: hanya field yang benar-benar berubah yang dikirim ke
 *   `PATCH /sessions/{id}`. Tombol Simpan mati selama belum ada perubahan.
 * - Aturan status (cermin backend, hanya untuk UX — backend tetap penentu):
 *     draft  -> semua field bisa diubah
 *     opened -> HANYA nama; tanggal & jam dikunci
 *   Sesi 'closed' tidak pernah membuka modal ini (tombol Edit nonaktif).
 * - LOADING: tombol & semua input dinonaktifkan selama request berjalan.
 * - Validasi klien = umpan balik cepat; gerbang sebenarnya di backend
 *   (termasuk tabrakan jadwal yang paling akhir, `_assert_no_session_overlap`).
 */

import React, { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import { OperationalSession, OperationalSessionUpdatePayload } from "../../types";
import { formatDateID, toApiTime, toTimeInputValue } from "../../utils/formatters";

interface SessionEditModalProps {
  session: OperationalSession;
  /** Sesi lain di daftar — dipakai cek bentrok jadwal cepat di sisi klien. */
  otherSessions: OperationalSession[];
  /**
   * Mengirim perubahan ke server. HARUS melempar error (idealnya `ApiError`)
   * kalau gagal; modal menampilkannya dan tetap terbuka supaya input tidak
   * hilang. Kalau sukses, pemanggil yang menutup modal.
   */
  onSubmit: (changes: OperationalSessionUpdatePayload) => Promise<void>;
  onClose: () => void;
}

const MAX_NAME_LENGTH = 100; // cermin Field(max_length=100) di backend

const inputClass =
  "w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fb9418] focus:border-[#fb9418] outline-none bg-white text-sm text-black shadow-sm disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";
const labelClass = "block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-2";

const SessionEditModal: React.FC<SessionEditModalProps> = ({ session, otherSessions, onSubmit, onClose }) => {
  const initial = useMemo(
    () => ({
      name: session.name,
      date: session.date,
      start_time: toTimeInputValue(session.start_time),
      end_time: toTimeInputValue(session.end_time),
    }),
    [session]
  );

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleLocked = session.status !== "draft";

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setError(null);
  };

  /** Field yang berbeda dari nilai awal -> isi body PATCH. */
  const changes = useMemo(() => {
    const out: OperationalSessionUpdatePayload = {};
    const name = form.name.trim();
    if (name !== initial.name) out.name = name;
    if (!scheduleLocked) {
      if (form.date !== initial.date) out.date = form.date;
      if (form.start_time !== initial.start_time) out.start_time = toApiTime(form.start_time);
      if (form.end_time !== initial.end_time) out.end_time = toApiTime(form.end_time);
    }
    return out;
  }, [form, initial, scheduleLocked]);

  const isDirty = Object.keys(changes).length > 0;

  // Escape menutup, kecuali saat sedang menyimpan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  /** Mengembalikan pesan error validasi, atau null kalau form valid. */
  const validate = (): string | null => {
    const name = form.name.trim();
    if (!name) return "Nama sesi wajib diisi.";
    if (name.length > MAX_NAME_LENGTH) return `Nama sesi maksimal ${MAX_NAME_LENGTH} karakter.`;
    if (scheduleLocked) return null;

    if (!form.date || !form.start_time || !form.end_time) return "Tanggal, jam mulai, dan jam selesai wajib diisi.";
    if (form.end_time <= form.start_time) return "Jam selesai harus lebih besar dari jam mulai.";

    // Aturan half-open sama dengan backend: jadwal bersambung persis boleh.
    const clash = otherSessions.find(
      (s) =>
        s.id !== session.id &&
        s.date === form.date &&
        toTimeInputValue(s.start_time) < form.end_time &&
        toTimeInputValue(s.end_time) > form.start_time
    );
    if (clash) {
      return (
        `Jadwal bertabrakan dengan sesi "${clash.name}" ` +
        `(${toTimeInputValue(clash.start_time)}–${toTimeInputValue(clash.end_time)}) pada tanggal yang sama.`
      );
    }
    return null;
  };

  const handleSave = async () => {
    if (saving || !isDirty) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSubmit(changes);
      // Sukses: pemanggil menutup modal. Tidak ada setState lagi di sini
      // karena komponen ini bisa sudah ter-unmount.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan perubahan.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-edit-title"
        className="bg-[#fcfcfc] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]"
      >
        <header className="bg-black border-b-4 border-[#fb9418] p-5 flex justify-between items-center shrink-0">
          <div>
            <h3 id="session-edit-title" className="text-lg font-bold text-[#fcfcfc] uppercase tracking-wider">
              Edit Sesi
            </h3>
            <p className="text-[11px] text-gray-400 font-mono mt-1">
              {formatDateID(session.date)} · {toTimeInputValue(session.start_time)}–{toTimeInputValue(session.end_time)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className="text-gray-400 hover:text-white text-2xl font-bold px-2 disabled:opacity-40"
          >
            ✕
          </button>
        </header>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {error && (
            <div role="alert" className="p-3 bg-red-50 text-red-700 text-sm border-l-4 border-red-500 rounded-r">
              {error}
            </div>
          )}

          {scheduleLocked && (
            <div className="p-3 bg-amber-50 text-amber-800 text-xs border-l-4 border-amber-400 rounded-r">
              Sesi ini sedang <strong>Dibuka</strong>, jadi hanya namanya yang bisa diubah. Tanggal & jam dikunci
              karena transaksi mungkin sudah berjalan.
            </div>
          )}

          <div>
            <label htmlFor="edit-session-name" className={labelClass}>
              Nama Sesi
            </label>
            <input
              id="edit-session-name"
              type="text"
              value={form.name}
              onChange={set("name")}
              maxLength={MAX_NAME_LENGTH}
              disabled={saving}
              autoFocus
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="edit-session-date" className={labelClass}>
              Tanggal
            </label>
            <input
              id="edit-session-date"
              type="date"
              value={form.date}
              onChange={set("date")}
              disabled={saving || scheduleLocked}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-session-start" className={labelClass}>
                Jam Mulai
              </label>
              <input
                id="edit-session-start"
                type="time"
                value={form.start_time}
                onChange={set("start_time")}
                disabled={saving || scheduleLocked}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="edit-session-end" className={labelClass}>
                Jam Selesai
              </label>
              <input
                id="edit-session-end"
                type="time"
                value={form.end_time}
                onChange={set("end_time")}
                disabled={saving || scheduleLocked}
                className={inputClass}
              />
            </div>
          </div>

          <p className="text-[11px] text-gray-400">
            Tiket yang dijual tidak bisa diubah di sini. Jika perlu mengganti tiket, hapus sesi draft lalu buat ulang.
          </p>
        </div>

        <div className="p-5 border-t border-gray-200 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-bold rounded-lg disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-6 py-2.5 bg-[#fb9418] text-white hover:bg-orange-500 font-bold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionEditModal;
