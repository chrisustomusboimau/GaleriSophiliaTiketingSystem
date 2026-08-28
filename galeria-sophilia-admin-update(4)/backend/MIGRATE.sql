-- backend/MIGRATE.sql
-- ==========================================================
-- Migrasi manual WAJIB dijalankan SEKALI kalau database Anda sudah
-- pernah dijalankan sebelumnya (sudah ada baris data). `create_db_and_
-- tables()` di app/db.py memakai `Base.metadata.create_all()`, yang
-- HANYA membuat tabel yang belum ada — tidak menambahkan kolom baru ke
-- tabel yang sudah eksis.
--
-- Kalau ini instalasi BARU (database masih kosong / belum pernah
-- dijalankan sama sekali), Anda TIDAK perlu menjalankan file ini —
-- cukup jalankan aplikasi seperti biasa, `create_all()` akan membuat
-- kedua tabel di bawah lengkap dengan kolom is_active dari awal.
--
-- Cara pakai (contoh via psql):
--   psql "$DATABASE_URL" -f backend/MIGRATE.sql
-- ==========================================================

ALTER TABLE ticket_masters
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE ticket_sub_categories
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Opsional tapi disarankan: index parsial supaya query
-- "WHERE is_active = true" (dipakai di GET /ticket-masters default) tetap
-- cepat walau datanya sudah besar.
CREATE INDEX IF NOT EXISTS ix_ticket_masters_is_active
    ON ticket_masters (is_active);

CREATE INDEX IF NOT EXISTS ix_ticket_sub_categories_is_active
    ON ticket_sub_categories (is_active);
