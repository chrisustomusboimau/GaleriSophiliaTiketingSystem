-- ==========================================================
-- MIGRASI: NAMA TIKET MULTI-BAHASA (name_i18n)
-- Jalankan SEKALI, secara manual, terhadap database yang SUDAH ADA.
--
-- KENAPA MANUAL: `create_db_and_tables()` di app/db.py hanya menjalankan
-- `Base.metadata.create_all()`, yang HANYA membuat tabel yang belum ada —
-- ia TIDAK menambahkan kolom baru ke tabel yang sudah eksis. Untuk
-- instalasi BARU (database kosong), file ini tidak perlu dijalankan sama
-- sekali: create_all() sudah membuat semua kolom & constraint di bawah.
--
-- ⚠️  BACA SEBELUM MENJALANKAN — SOAL BACKFILL:
-- Baris yang sudah ada cuma punya satu nama (Bahasa Indonesia). Script ini
-- MENYALIN nama Indonesia itu ke slot English juga, semata-mata supaya
-- tidak ada baris yang melanggar CHECK constraint baru. Artinya, setelah
-- migrasi, pengunjung berbahasa Inggris masih melihat nama Indonesia
-- sampai admin membuka panel Master Tiket dan mengisi nama English yang
-- sebenarnya. Di panel admin, nama English ditampilkan sebagai subteks di
-- bawah nama Indonesia justru supaya sisa placeholder ini mudah dikenali.
--
-- Aman dijalankan berulang kali (idempoten).
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 1) TAMBAH KOLOM
-- ----------------------------------------------------------
ALTER TABLE ticket_masters
    ADD COLUMN IF NOT EXISTS name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ticket_sub_categories
    ADD COLUMN IF NOT EXISTS name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE transaction_items
    ADD COLUMN IF NOT EXISTS ticket_name_snapshot_i18n JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------------------------
-- 2) BACKFILL — salin nama lama ke slot 'id' DAN 'en'
--    (lihat peringatan di kepala file)
-- ----------------------------------------------------------
UPDATE ticket_masters
   SET name_i18n = jsonb_build_object('id', name, 'en', name)
 WHERE name_i18n = '{}'::jsonb
    OR btrim(coalesce(name_i18n->>'id','')) = ''
    OR btrim(coalesce(name_i18n->>'en','')) = '';

UPDATE ticket_sub_categories
   SET name_i18n = jsonb_build_object('id', name, 'en', name)
 WHERE name_i18n = '{}'::jsonb
    OR btrim(coalesce(name_i18n->>'id','')) = ''
    OR btrim(coalesce(name_i18n->>'en','')) = '';

UPDATE transaction_items
   SET ticket_name_snapshot_i18n = jsonb_build_object(
           'id', ticket_name_snapshot,
           'en', ticket_name_snapshot
       )
 WHERE ticket_name_snapshot_i18n = '{}'::jsonb
    OR btrim(coalesce(ticket_name_snapshot_i18n->>'id','')) = ''
    OR btrim(coalesce(ticket_name_snapshot_i18n->>'en','')) = '';

-- ----------------------------------------------------------
-- 3) CHECK CONSTRAINT — baru dipasang SETELAH backfill,
--    kalau tidak setiap baris lama akan menolak migrasi ini.
--    Memakai ->> (bukan operator ?) agar konsisten dengan definisi
--    model di app/db.py dan tidak bentrok dengan paramstyle SQLAlchemy.
-- ----------------------------------------------------------
ALTER TABLE ticket_masters
    DROP CONSTRAINT IF EXISTS ck_ticket_master_name_i18n_required;
ALTER TABLE ticket_masters
    ADD CONSTRAINT ck_ticket_master_name_i18n_required
    CHECK (btrim(coalesce(name_i18n->>'id','')) <> '' AND btrim(coalesce(name_i18n->>'en','')) <> '');

ALTER TABLE ticket_sub_categories
    DROP CONSTRAINT IF EXISTS ck_sub_category_name_i18n_required;
ALTER TABLE ticket_sub_categories
    ADD CONSTRAINT ck_sub_category_name_i18n_required
    CHECK (btrim(coalesce(name_i18n->>'id','')) <> '' AND btrim(coalesce(name_i18n->>'en','')) <> '');

-- CATATAN: transaction_items sengaja TIDAK diberi CHECK. Baris di sana
-- adalah riwayat historis yang tidak boleh gagal ditulis ulang; kalau
-- suatu saat ada snapshot i18n kosong, pembaca sudah jatuh ke kolom
-- cermin `ticket_name_snapshot` lewat resolveName() di frontend.

COMMIT;

-- ==========================================================
-- 4) VERIFIKASI (jalankan setelah COMMIT)
-- ==========================================================
-- Harus mengembalikan 0 baris:
--   SELECT id, name FROM ticket_masters
--    WHERE btrim(coalesce(name_i18n->>'en','')) = '';
--
-- Daftar tiket yang nama English-nya masih placeholder hasil backfill
-- (nama English identik dengan nama Indonesia) — ini yang perlu
-- diterjemahkan admin lewat panel Master Tiket:
--   SELECT name FROM ticket_masters        WHERE name_i18n->>'en' = name_i18n->>'id';
--   SELECT name FROM ticket_sub_categories WHERE name_i18n->>'en' = name_i18n->>'id';
