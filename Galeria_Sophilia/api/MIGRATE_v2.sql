-- ==========================================================
-- MIGRASI v2: TERMINAL PEMBAYARAN, SESI KASIR, APPROVAL CHECKER,
--             & MASTER VARIAN KATEGORI USIA
--
-- Jalankan SEKALI, secara manual, terhadap database yang SUDAH ADA:
--     psql "$DATABASE_URL" -f api/MIGRATE_v2.sql
--
-- KENAPA MANUAL: `create_db_and_tables()` di app/db.py hanya menjalankan
-- `Base.metadata.create_all()` — itu HANYA membuat tabel yang belum ada,
-- dan TIDAK PERNAH menambahkan kolom baru ke tabel yang sudah eksis.
-- Untuk instalasi BARU (database kosong), file ini tidak perlu dijalankan
-- sama sekali: create_all() sudah membuat semua tabel, kolom, dan
-- constraint di bawah dari model SQLAlchemy.
--
-- Aman dijalankan berulang kali (idempoten). Seluruhnya satu transaksi:
-- kalau ada satu langkah yang gagal, TIDAK ADA perubahan yang tersimpan.
-- ==========================================================

BEGIN;

-- ==========================================================
-- 0) PRA-SYARAT: NAMA TABEL USER
-- ==========================================================
-- fastapi-users (SQLAlchemyBaseUserTableUUID) memberi nama tabelnya
-- "user" — kata kunci SQL, jadi SELALU ditulis dalam tanda kutip ganda.
-- Kalau instalasi Anda memakai nama lain, migrasi ini berhenti di sini
-- dengan pesan jelas, bukan gagal setengah jalan di tengah FK.
DO $$
BEGIN
    IF to_regclass('public."user"') IS NULL THEN
        RAISE EXCEPTION
            'Tabel "user" tidak ditemukan. File ini mengasumsikan nama tabel bawaan '
            'fastapi-users. Sesuaikan referensi "user"(id) pada bagian 4 & 5 dengan '
            'nama tabel akun staf di database Anda, lalu jalankan ulang.';
    END IF;
END $$;

-- ==========================================================
-- 1) TERMINAL PEMBAYARAN (EDC / QRIS / Tunai)
-- ==========================================================
-- `category` sengaja memakai nilai yang SUDAH dipakai kolom
-- transactions.payment_method ('qris','card','cash') — 'card' ADALAH
-- kategori EDC. Dengan begitu tidak ada satu pun baris transaksi lama
-- yang perlu ditulis ulang; yang berubah cuma labelnya di frontend.
CREATE TABLE IF NOT EXISTS payment_terminals (
    id        UUID    PRIMARY KEY,
    name      VARCHAR NOT NULL UNIQUE,
    category  VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_payment_terminal_category_valid
        CHECK (category IN ('qris', 'card', 'cash'))
);


-- ==========================================================
-- 2) MASTER VARIAN KATEGORI USIA
-- ==========================================================
-- Sumber tunggal varian usia. Sejak sekarang, varian pada Master Tiket
-- TIDAK diketik manual lagi — ia ter-generate dari tabel ini, dan admin
-- hanya mengisi harga per varian.
CREATE TABLE IF NOT EXISTS age_categories (
    id        UUID    PRIMARY KEY,
    name      VARCHAR NOT NULL,
    name_i18n JSONB   NOT NULL DEFAULT '{}'::jsonb,
    min_age   INTEGER NOT NULL DEFAULT 0,
    max_age   INTEGER NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_age_category_range_valid
        CHECK (max_age IS NULL OR max_age >= min_age),
    CONSTRAINT ck_age_category_name_i18n_required
        CHECK (btrim(coalesce(name_i18n->>'id','')) <> ''
           AND btrim(coalesce(name_i18n->>'en','')) <> '')
);

-- --- 2a) BACKFILL: bentuk master varian dari varian yang sudah ada ---
-- Kunci dedupe = (nama, usia minimum, usia maksimum). Dua varian dengan
-- nama & rentang usia identik di lantai berbeda melebur jadi SATU master
-- varian — itulah inti dari sentralisasi ini.
-- `IS NOT DISTINCT FROM` dipakai untuk max_age karena NULL (tanpa batas
-- atas) harus dianggap sama dengan NULL, sedangkan `=` tidak begitu.
INSERT INTO age_categories (id, name, name_i18n, min_age, max_age, is_active)
SELECT DISTINCT ON (sc.name, sc.min_age, sc.max_age)
       gen_random_uuid(),
       sc.name,
       -- Jaring pengaman kalau ada baris lama yang name_i18n-nya masih
       -- kosong: CHECK constraint di atas akan menolaknya.
       CASE WHEN btrim(coalesce(sc.name_i18n->>'id','')) = ''
              OR btrim(coalesce(sc.name_i18n->>'en','')) = ''
            THEN jsonb_build_object('id', sc.name, 'en', sc.name)
            ELSE sc.name_i18n
       END,
       sc.min_age,
       sc.max_age,
       TRUE
  FROM ticket_sub_categories sc
 WHERE sc.is_active
   AND NOT EXISTS (
           SELECT 1 FROM age_categories ac
            WHERE ac.name    =  sc.name
              AND ac.min_age =  sc.min_age
              AND ac.max_age IS NOT DISTINCT FROM sc.max_age
       )
 ORDER BY sc.name, sc.min_age, sc.max_age, sc.id;


-- ==========================================================
-- 3) TAUTKAN SUB-KATEGORI TIKET KE MASTER VARIAN USIA
-- ==========================================================
-- Kolom name / name_i18n / min_age / max_age di ticket_sub_categories
-- SENGAJA DIPERTAHANKAN sebagai SNAPSHOT: mengganti nama master varian
-- besok tidak boleh mengubah sesi & riwayat transaksi yang sudah jalan.
ALTER TABLE ticket_sub_categories
    ADD COLUMN IF NOT EXISTS age_category_id UUID NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sub_category_age_category'
    ) THEN
        ALTER TABLE ticket_sub_categories
            ADD CONSTRAINT fk_sub_category_age_category
            FOREIGN KEY (age_category_id) REFERENCES age_categories(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

UPDATE ticket_sub_categories sc
   SET age_category_id = ac.id
  FROM age_categories ac
 WHERE sc.age_category_id IS NULL
   AND ac.name    =  sc.name
   AND ac.min_age =  sc.min_age
   AND ac.max_age IS NOT DISTINCT FROM sc.max_age;

-- Satu harga per varian usia per master tiket. NULL diperbolehkan
-- berkali-kali oleh Postgres, jadi baris legacy yang tidak tertaut
-- (age_category_id IS NULL) tidak diblokir constraint ini.
DO $$
DECLARE
    dupe_count INTEGER;
BEGIN
    SELECT count(*) INTO dupe_count FROM (
        SELECT ticket_master_id, age_category_id
          FROM ticket_sub_categories
         WHERE age_category_id IS NOT NULL
         GROUP BY ticket_master_id, age_category_id
        HAVING count(*) > 1
    ) d;

    IF dupe_count > 0 THEN
        RAISE EXCEPTION
            'Migrasi dibatalkan: ada % kombinasi (master tiket, varian usia) yang '
            'terduplikasi. Gabungkan/nonaktifkan varian kembar itu dulu lewat panel '
            'Master Tiket, lalu jalankan ulang file ini. Query pemeriksanya ada di '
            'blok VERIFIKASI pada bagian akhir file.', dupe_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_age_category_per_master'
    ) THEN
        ALTER TABLE ticket_sub_categories
            ADD CONSTRAINT uq_age_category_per_master
            UNIQUE (ticket_master_id, age_category_id);
    END IF;
END $$;


-- ==========================================================
-- 4) SESI KASIR & TERMINAL YANG DIPAKAINYA
-- ==========================================================
CREATE TABLE IF NOT EXISTS cashier_sessions (
    id         UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES operational_sessions(id) ON DELETE RESTRICT,
    user_id    UUID NOT NULL REFERENCES "user"(id)              ON DELETE RESTRICT,
    opened_at  TIMESTAMPTZ NOT NULL,
    closed_at  TIMESTAMPTZ NULL
);

-- Satu kasir hanya boleh punya SATU sesi kasir terbuka pada satu waktu.
-- Partial unique index (bukan UNIQUE constraint biasa) supaya sesi yang
-- sudah ditutup tidak ikut memblokir sesi berikutnya.
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_open_cashier_session
    ON cashier_sessions (user_id) WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_cashier_sessions_session_id
    ON cashier_sessions (session_id);

CREATE TABLE IF NOT EXISTS cashier_session_terminals (
    id                  UUID PRIMARY KEY,
    cashier_session_id  UUID NOT NULL REFERENCES cashier_sessions(id)  ON DELETE CASCADE,
    payment_terminal_id UUID NOT NULL REFERENCES payment_terminals(id) ON DELETE RESTRICT,
    CONSTRAINT uq_terminal_per_cashier_session
        UNIQUE (cashier_session_id, payment_terminal_id)
);


-- ==========================================================
-- 5) TRANSAKSI: DETAIL METODE PEMBAYARAN & STATUS VERIFIKASI
-- ==========================================================
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS payment_terminal_id   UUID        NULL,
    ADD COLUMN IF NOT EXISTS payment_method_detail VARCHAR     NULL,
    ADD COLUMN IF NOT EXISTS cashier_session_id    UUID        NULL,
    ADD COLUMN IF NOT EXISTS verification_status   VARCHAR     NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS verified_by_id        UUID        NULL,
    ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transaction_payment_terminal') THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_transaction_payment_terminal
            FOREIGN KEY (payment_terminal_id) REFERENCES payment_terminals(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transaction_cashier_session') THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_transaction_cashier_session
            FOREIGN KEY (cashier_session_id) REFERENCES cashier_sessions(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_transaction_verified_by') THEN
        ALTER TABLE transactions ADD CONSTRAINT fk_transaction_verified_by
            FOREIGN KEY (verified_by_id) REFERENCES "user"(id) ON DELETE SET NULL;
    END IF;
END $$;

-- CHECK dipasang SETELAH kolomnya terisi DEFAULT 'pending' untuk semua
-- baris lama, kalau tidak setiap transaksi lama akan menolak migrasi ini.
ALTER TABLE transactions
    DROP CONSTRAINT IF EXISTS ck_transaction_verification_status_valid;
ALTER TABLE transactions
    ADD CONSTRAINT ck_transaction_verification_status_valid
    CHECK (verification_status IN ('pending', 'approved'));

CREATE INDEX IF NOT EXISTS ix_transactions_verification_status
    ON transactions (verification_status);

COMMIT;


-- ==========================================================
-- 6) VERIFIKASI (jalankan setelah COMMIT)
-- ==========================================================
-- a) Sub-kategori tiket AKTIF yang belum tertaut master varian usia.
--    Harus 0 baris. Kalau ada, tautkan manual lewat panel Master Tiket.
--      SELECT sc.id, tm.name AS master, sc.name AS varian, sc.min_age, sc.max_age
--        FROM ticket_sub_categories sc
--        JOIN ticket_masters tm ON tm.id = sc.ticket_master_id
--       WHERE sc.is_active AND sc.age_category_id IS NULL;
--
-- b) Kombinasi (master tiket, varian usia) yang terduplikasi.
--    Harus 0 baris — kalau tidak, blok DO di bagian 3 sudah membatalkan
--    migrasi dan constraint uq_age_category_per_master belum terpasang.
--      SELECT ticket_master_id, age_category_id, count(*)
--        FROM ticket_sub_categories
--       WHERE age_category_id IS NOT NULL
--       GROUP BY ticket_master_id, age_category_id
--      HAVING count(*) > 1;
--
-- c) Master varian usia hasil backfill — periksa & rapikan namanya
--    (terutama terjemahan English yang mungkin masih placeholder).
--      SELECT name, name_i18n->>'en' AS en, min_age, max_age FROM age_categories ORDER BY min_age;
--
-- d) Terminal pembayaran masih kosong setelah migrasi — ini normal.
--    Admin membuatnya lewat panel "Terminal Pembayaran":
--      SELECT count(*) FROM payment_terminals;
