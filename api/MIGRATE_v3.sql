-- ==========================================================
-- MIGRATE_v3.sql
-- ==========================================================
-- Perubahan pada putaran ini:
--   1) Kolom BARU `transactions.confirmed_by_id` — staf (kasir/admin)
--      yang menekan "Konfirmasi" dan mengunci antrean ke status
--      "confirmed"/"paid". Dipakai kolom "Dikonfirmasi Oleh" di tabel
--      Riwayat Transaksi, MENGGANTIKAN kolom "Verifikasi" (Checker) yang
--      sudah dihapus dari UI sejak role Checker menjadi read-only.
--
-- ⚠️ Seperti migrasi sebelumnya, `create_db_and_tables()` HANYA membuat
-- tabel yang belum ada dan TIDAK menambahkan kolom baru ke tabel yang
-- sudah eksis. Jalankan skrip ini SEKALI pada database yang sudah pernah
-- dijalankan sebelum kolom ini ditambahkan. Instalasi BARU (database
-- kosong) tidak perlu menjalankan ini — `create_all()` sudah membuat
-- kolomnya dari awal.
-- ==========================================================

BEGIN;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS confirmed_by_id UUID NULL
        REFERENCES "user"(id) ON DELETE SET NULL;

COMMIT;

-- ==========================================================
-- VERIFIKASI (jalankan setelah COMMIT)
-- ==========================================================
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'transactions' AND column_name = 'confirmed_by_id';
