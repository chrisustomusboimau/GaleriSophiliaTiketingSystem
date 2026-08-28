# Migrasi Admin Panel → Backend Baru + Navigasi Per-Sesi & RBAC Route-Level

Dokumen ini mencakup SELURUH perubahan sampai saat ini (5 putaran: master-data/RBAC
awal, navigasi per-sesi, revisi RBAC sesi + Ringkasan terintegrasi, perbaikan bug
database + alur bisnis, dan putaran **terbaru**: penyesuaian alur pembelian tiket
pengunjung publik). Salin folder `src/` ini menimpa `src/` proyek Anda, dan
**`backend/app/*.py` menimpa `app/*.py` di server Anda**.

## -2. PUTARAN TERBARU — Alur Pembelian Tiket Pengunjung (Publik)

Ini putaran pertama saya benar-benar melihat `TicketSelectionPage.tsx`,
`FloorCard.tsx`, `QueuePage.tsx`, dan `QueueDisplay.tsx` yang sebenarnya — jadi
sekaligus jadi kesempatan menyambungkannya penuh ke backend baru.

### -2.1 Temuan penting: endpoint publik tidak pernah membawa nama lantai
`GET /sessions/active` (satu-satunya sumber data yang boleh diakses pengunjung
tanpa login) mengembalikan `sub_category` per tiket aktif, tapi
`TicketSubCategoryRead` sebelumnya **tidak pernah** membawa nama Master Tiket
induknya (cuma `ticket_master_id`, sebuah UUID) — dan endpoint yang punya nama
itu (`GET /ticket-masters`) khusus staf. Akibatnya `TicketSelectionPage.tsx`
tidak akan pernah bisa menampilkan label lantai yang benar ("Lantai 1", dst.)
ke pengunjung publik.

**Perbaikan backend (kecil, aman, TANPA migrasi):** ditambahkan properti
komputasi `TicketSubCategory.ticket_master_name` di `app/db.py` (bukan kolom
database — cuma mengembalikan `self.ticket_master.name`, yang memang sudah
selalu ikut termuat lewat relasi `lazy="selectin"` yang sudah ada) dan field
`ticket_master_name: Optional[str]` baru di `TicketSubCategoryRead`
(`app/schema.py`). Otomatis terisi di SEMUA endpoint yang memakai skema ini,
termasuk `GET /sessions/active` — tidak perlu ubah `main.py` sama sekali.

### -2.2 Berkas yang ditulis ulang total
```
src/pages/TicketSelectionPage.tsx   Sebelumnya: 3 lantai + harga HARDCODED.
                                     Sekarang: fetch GET /sessions/active,
                                     kelompokkan per Master Tiket (jumlah &
                                     nama bebas sesuai konfigurasi admin).
                                     `selectedFloors` yang dikirim ke
                                     /visitor-form sekarang berisi
                                     ticket_master_id SUNGGUHAN (UUID) —
                                     inilah yang membuatnya benar-benar
                                     nyambung ke pencocokan di VisitorForm.tsx
                                     (yang sejak putaran sebelumnya sudah
                                     menunggu id asli, bukan string "Floor 1").
src/components/FloorCard.tsx        Sebelumnya: props tetap {adult,student,
                                     child}. Sekarang: array varian dinamis
                                     {id,name,price} — render sebanyak apa
                                     pun varian yang ada.
src/pages/QueuePage.tsx             Fetch data lewat api/client (apiGet) +
                                     tipe TransactionEntry asli, bukan raw
                                     fetch dengan tipe Visitor lokal lama.
src/components/QueueDisplay.tsx     Rincian tiket dikelompokkan dari
                                     `ticket_name_snapshot` (via
                                     splitTicketSnapshot, sama seperti
                                     dashboard kasir) — bukan lagi field
                                     floor/age_category terpisah yang sudah
                                     tidak ada di backend. Menampilkan nama
                                     pemesan (customer_name, sekarang wajib
                                     ada). Mendukung 3 metode pembayaran
                                     (qris/card/cash) lengkap dengan teks
                                     instruksi masing-masing.
```

### -2.3 Tidak berubah
`src/components/VisitorForm.tsx` **tidak disentuh sama sekali** pada putaran
ini — sejak putaran sebelumnya sudah benar (mencocokkan `selectedFloors`
lewat `sub.ticket_master_id`, field `customer_name` wajib, dsb.). Ia otomatis
langsung nyambung begitu `TicketSelectionPage.tsx` mengirim id master
sungguhan.

### -2.4 Translasi baru
`src/contexts/LanguageContext.tsx` ditambah beberapa key baru (id/en/zh):
`loadingTickets`, `noActiveSessionMessage`, `noTicketsAvailable`,
`retryButton`, `perPersonLabel`, `orderedByLabel`, `cashPaymentLabel`,
`cashInstruction`. Sebagai bonus, `QueueDisplay.tsx` yang baru juga akhirnya
memakai beberapa key yang SUDAH ADA sebelumnya tapi belum pernah dipanggil di
mana pun (`qrisInstruction`, `cardInstruction`, `ticketDetails`,
`yourPaymentMethod`, `noTicketData`) — jadi kelihatan "baru" tapi sebenarnya
cuma baru dipakai.

### -2.5 Housekeeping (tidak diubah, cuma diberi tahu)
- `src/components/UserEditModal.tsx` — mengimpor `./UserManagementComponent`
  yang **tidak ada** di proyek Anda (file mati/broken import), tapi juga
  **tidak pernah diimpor** oleh file lain mana pun (sisa dari sebelum
  `UserManager.tsx` dibuat). Aman dihapus.
- `src/pages/GalleryInfoPage.tsx` — sengaja TIDAK disentuh; isinya teks
  marketing statis (deskripsi Lantai 1/5/6&7) yang tidak mengambil data dari
  backend sama sekali, jadi di luar cakupan "pembelian tiket". Tapi karena
  isinya mengasumsikan persis 3 lantai dengan nama tetap, kontennya akan
  jadi tidak sinkron kalau admin menambah/mengubah/menghapus Master Tiket —
  itu murni pekerjaan menyunting teks, beri tahu saya kalau mau saya
  jadikan dinamis juga.
- `src/pages/PaymentHistoryPage.tsx` & `src/pages/SummaryPage.tsx` masih ada
  di proyek Anda tapi sudah tidak dirutekan ke mana pun sejak beberapa
  putaran lalu — aman dihapus kapan saja.

---

## -1. PUTARAN TERBARU — Backend: bug FK, RBAC, bulk-save, alur "isi nomor awal"

### -1.1 Bug FK saat hapus Master Tiket/Sub-Kategori — SUDAH DIPERBAIKI (soft delete)
Root cause: `ticket_sub_categories` di-hard-delete (`DELETE FROM`) padahal masih
direferensikan `transaction_items` (FK `ondelete="RESTRICT"`). Sekarang **tidak
pernah lagi** menjalankan `DELETE FROM` untuk kedua tabel ini — endpoint hapus
hanya mengubah `is_active = False` (soft delete), diterapkan konsisten ke
`TicketMaster` **dan** `TicketSubCategory` (kalau master dihapus, seluruh
variannya ikut dinonaktifkan, bukan di-cascade-hard-delete, supaya tidak
memicu bug FK yang sama dari sisi master).

**⚠️ MIGRASI DATABASE WAJIB (kalau database sudah pernah dijalankan):**
```sql
ALTER TABLE ticket_masters        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ticket_sub_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
```
Skrip lengkap (+ index) ada di `backend/MIGRATE.sql` dalam paket ini. Jalankan
SEKALI sebelum deploy `app/main.py` & `app/db.py` yang baru. Kalau database Anda
masih kosong (instalasi baru), lewati langkah ini — `create_db_and_tables()`
otomatis membuat kolom ini dari awal.

Efek samping (byproduct) yang sengaja ditambahkan sekalian:
- `GET /ticket-masters` sekarang default hanya mengembalikan yang `is_active=true`
  (tambah `?include_inactive=true` untuk lihat semua) — supaya tiket yang sudah
  "dihapus" tidak lagi muncul sebagai pilihan di sesi/kasir baru.
- `PATCH /ticket-masters/{id}` & `PATCH /ticket-sub-categories/{id}` menerima
  field baru `is_active: bool` — admin bisa "mengaktifkan kembali" tanpa endpoint
  baru. Sudah dipasang di `TicketMasterManager.tsx` (tombol "Nonaktifkan" ⇄
  "Aktifkan" + toggle "Tampilkan Nonaktif").
- `POST /sessions` & `POST /transactions` sekarang menolak sub-kategori yang
  sudah `is_active=false` (jaga-jaga kalau dinonaktifkan di tengah sesi berjalan).

### -1.2 RBAC: Buka/Tutup sesi kini ADMIN-ONLY di BACKEND juga
Sebelumnya frontend sudah membatasi ini, tapi endpoint `PATCH /sessions/{id}/open`
& `.../close` masih memakai `Depends(current_kasir)` (admin+kasir keduanya lolos
lewat panggilan API langsung). Sekarang keduanya pakai `Depends(current_admin)` —
celah keamanan ini tertutup di level backend, bukan cuma disembunyikan di UI.

### -1.3 Alur baru: "Buka Sesi" tidak lagi mewajibkan nomor awal di muka
**Perubahan alur bisnis signifikan.** Sebelumnya, admin harus tahu/mengisi nomor
tiket fisik awal SEMUA varian dulu sebelum bisa menekan "Buka Sesi" (divalidasi
backend). Sekarang:
- `PATCH /sessions/{id}/open` **tidak lagi** memvalidasi nomor awal — admin bisa
  membuka sesi langsung setelah membuatnya, tanpa perlu tahu nomor tiket fisik
  di muka (masuk akal karena kasir yang pegang tiket fisiknya di lapangan).
- Sebagai gantinya, gerbang baru dipasang di **frontend**: kasir yang membuka
  `/sesi/:sessionId` untuk sesi yang sudah 'opened' tapi ada varian yang nomor
  awalnya belum diisi, akan disambut layar "Lengkapi Nomor Tiket Awal" (form
  bulk-save) SEBELUM bisa melihat tab Antrian/Riwayat/Ringkasan. Admin tidak
  pernah digerbang ini (akses penuh kapan pun).
- `close_operational_session` **TIDAK berubah** — tetap mewajibkan nomor akhir
  terisi semua sebelum sesi bisa ditutup (ini tidak diminta untuk diubah).

### -1.4 Fleksibilitas edit nomor awal/akhir (backend + frontend)
`set_start_ticket_number` & `set_end_ticket_number` sekarang memvalidasi status
sesi induknya (draft/opened untuk nomor awal; opened saja untuk nomor akhir) —
sebelumnya endpoint ini tidak mengecek status sesi sama sekali (celah backend).
Nilai TIDAK lagi terkunci setelah 1x disimpan; boleh diedit berulang kali selama
sesi masih dalam status yang diizinkan.

### -1.5 BARU: endpoint bulk-save `PATCH /sessions/{id}/audit/bulk`
Menyimpan nomor awal **dan/atau** akhir untuk BANYAK tiket sekaligus dalam SATU
transaksi database (all-or-nothing — divalidasi dua pass: validasi semua dulu,
baru diterapkan semua; kalau satu saja gagal, TIDAK ADA yang tersimpan). Dipakai
oleh:
- `SessionAuditForm.tsx` (komponen BARU, `src/components/admin/`) — satu tombol
  "Simpan Semua Perubahan"/"Simpan & Lanjutkan" menggantikan tombol "Simpan"
  per-baris yang lama.
- Dipasang di DUA tempat: modal "Detail / Audit" (`OperationalSessionManager.tsx`,
  daftar sesi) dan gerbang "Lengkapi Nomor Tiket Awal" (`SessionDetailPage.tsx`).
- Endpoint per-field lama (`/session-tickets/{id}/audit/start` & `/end`)
  DIPERTAHANKAN (tidak dihapus) untuk kompatibilitas, kini juga tervalidasi
  status sesi seperti di atas — tapi frontend sudah 100% pindah ke endpoint bulk.

### -1.6 Ringkasan: filter dihapus, auto-load
Card "Filter Ringkasan" (dropdown status + input jam manual + preset lama)
dihapus total dari `Summary.tsx`. Sekarang otomatis: status Lunas/Dikonfirmasi
(`confirmed`/`paid`) SELALU, jendela waktu SELALU jam sesi (`start_time`–
`end_time`), tanpa kontrol interaktif apa pun — cuma info-bar statis yang
menjelaskan apa yang sedang ditampilkan. Bagian Audit Tiket (sudah digabung di
putaran sebelumnya) tidak pernah terpengaruh filter ini sama sekali.

### -1.7 Daftar berkas putaran ini

```
BACKEND (ganti utuh, ada di backend/app/ dalam paket ini):
  backend/app/db.py       Kolom is_active baru di TicketMaster & TicketSubCategory.
  backend/app/schema.py   Field is_active + schema bulk audit (baru).
  backend/app/main.py     Soft delete, admin-only open/close, validasi status sesi
                           di endpoint audit, endpoint bulk baru, validasi is_active
                           di create_operational_session & create_transaction.
  backend/MIGRATE.sql     Migrasi SQL manual (WAJIB kalau DB sudah pernah jalan).

FRONTEND baru:
  src/components/admin/SessionAuditForm.tsx   Form bulk-save satu tombol (BARU).

FRONTEND diubah:
  src/types/index.ts                  + is_active pada TicketMaster/TicketSubCategory,
                                       + tipe payload bulk audit.
  src/components/admin/OperationalSessionManager.tsx
                                       Modal audit pakai SessionAuditForm; Buka/Tutup
                                       tetap admin-only (sudah dari putaran sebelumnya,
                                       kini didukung juga oleh backend).
  src/pages/SessionDetailPage.tsx     + gerbang "Lengkapi Nomor Tiket Awal" untuk
                                       kasir/checker sebelum tab bisa diakses.
  src/components/Summary.tsx          Card "Filter Ringkasan" dihapus, auto-load.
  src/components/admin/TicketMasterManager.tsx
                                       "Hapus" → "Nonaktifkan"/"Aktifkan", + toggle
                                       "Tampilkan Nonaktif" (admin only).
```

---

## 0. Putaran terbaru: Revisi RBAC Sesi + Ringkasan Terintegrasi

### 0.1 RBAC sesi (siapa boleh apa)
| Aksi | Admin | Kasir | Checker |
|---|---|---|---|
| Lihat sesi draft/closed | ✅ | ❌ (disembunyikan total) | ❌ (disembunyikan total) |
| Lihat sesi opened | ✅ | ✅ | ✅ |
| Buka (Open) / Tutup (Close) sesi | ✅ | ❌ (**berubah dari sebelumnya**) | ❌ |
| Isi/edit No. Tiket Awal | ✅, kapan saja saat draft/opened | ✅, kapan saja saat opened | ❌ |
| Isi/edit No. Tiket Akhir | ✅, kapan saja saat opened | ✅, kapan saja saat opened | ❌ |
| Buat sesi baru, CRUD Master Tiket | ✅ | ❌ | ❌ |

Implementasi di `components/admin/OperationalSessionManager.tsx`:
- `canManageSession` (baru, admin-only) → tombol Buka/Tutup Sesi.
- `canEditAudit` (admin+kasir) → input No. Awal & Akhir. **Tidak terkunci lagi
  setelah diisi sekali** — sebelumnya No. Awal hanya bisa diisi saat status
  'draft' lalu terkunci; sekarang tetap bisa diedit selama status 'draft' ATAU
  'opened'.
- `loadSessions()` memaksa query `status=opened` untuk non-admin (plus filter
  ulang di client sebagai jaring pengaman), dan dropdown filter status
  disembunyikan total dari non-admin karena jadi tidak relevan.

**Guard tambahan di `pages/SessionDetailPage.tsx`**: kalau kasir/checker
mengakses `/sesi/:sessionId` untuk sesi yang BUKAN 'opened' (mis. sesi baru
saja ditutup admin saat kasir masih membuka halamannya, atau lewat bookmark
lama), mereka diblokir dengan panel "akses ditolak" + tombol kembali ke
`/sesi` — bukan cuma disembunyikan dari daftar, tapi juga diblokir langsung
di URL-nya.

### 0.2 Ringkasan & Audit Tiket digabung — `/admin/summary` DIHAPUS
Ini keputusan arsitektur yang saya ambil di luar permintaan literal, perlu
dipahami:

- `Summary.tsx` yang Anda kirim jelas dirancang untuk **satu sesi**, dan
  sebelumnya dipanggil dari tombol "Lihat Ringkasan" di halaman Riwayat yang
  `navigate("/admin/summary", { state: {...} })` — bergantung pada router
  state yang **hilang saat halaman di-refresh**.
- Karena itu, dan karena Anda minta Audit Tiket "tidak terpisah dari
  ringkasan sesi", saya jadikan **Ringkasan** sebagai **tab ketiga** di
  `/sesi/:sessionId` (Antrian Kasir | Riwayat Transaksi | **Ringkasan**),
  bukan halaman terpisah. Tab "Audit Tiket" yang sebelumnya berdiri sendiri
  di `/admin` (`AuditReportManager.tsx`) saya **hapus filenya** — datanya
  sekarang otomatis muncul di bagian atas tab Ringkasan setiap sesi.
- Konsekuensi: route `/admin/summary` dan `pages/SummaryPage.tsx` (yang
  memang tidak pernah Anda kirim) **tidak lagi dibutuhkan sama sekali** —
  gap yang sudah lama tertunda ini otomatis selesai.
- `components/Summary.tsx` ditulis ulang total: tidak ada lagi
  `TICKET_CATEGORIES` harga hardcoded per lantai; semua kartu statistik,
  tabel rekap penjualan (kini 3 metode: QRIS/Kartu/Tunai, bukan 2), dan
  tabel kepadatan per 30 menit sepenuhnya dinamis dari Master Data. Preset
  tombol waktu lama ("Minggu Pagi", dst.) dihapus karena tidak relevan lagi
  (sesi sekarang punya jam mulai/selesai sungguhan) — filter waktu di
  Ringkasan sekarang default ke jam sesi itu sendiri, dengan tombol "Reset
  ke Rentang Sesi".
- Bagian Audit Tiket di dalam Ringkasan **tidak terpengaruh** filter
  status/waktu di atasnya — selalu memakai seluruh transaksi sesi yang tidak
  dibatalkan, karena nomor tiket fisik tidak punya konsep "potongan waktu".

### 0.3 Berkas yang WAJIB DIHAPUS pada putaran ini
- **`src/components/admin/AuditReportManager.tsx`** — sudah tidak diimpor
  di mana pun, digantikan bagian Audit Tiket di dalam `Summary.tsx`.
- **`src/pages/SummaryPage.tsx`** (kalau pernah Anda buat/punya draftnya) —
  route `/admin/summary` sudah dihapus dari `App.tsx`.

---

## 1. Ringkasan alur navigasi baru (yang paling penting)

```
Login
 ├─ role = admin   → /admin  (Master Tiket / Audit Tiket / Akun Staf)
 └─ role = kasir/checker → /sesi  (landing page mereka)

/sesi (daftar Sesi Operasional — admin & non-admin sama-sama pakai halaman ini)
 └─ tekan "Detail / Audit" pada sebuah sesi → modal terbuka
      └─ isi Nomor Tiket Awal tiap varian → tekan "Buka Sesi"
           └─ tombol "Ke Detail Sesi" muncul (juga muncul di baris tabel
              untuk sesi yang statusnya sudah opened/closed)
                └─ /sesi/:sessionId
                     ├─ Tab "Antrian Kasir"      (dulu bagian dari /admin)
                     └─ Tab "Riwayat Transaksi"  (dulu halaman /admin/history)
                     KEDUANYA difilter ke sessionId ini saja.
```

**Non-admin (kasir/checker) HANYA bisa mengakses `/sesi` dan `/sesi/:sessionId`.**
Ini digaris-bawahi di LEVEL ROUTE lewat `RequireRole`, bukan cuma disembunyikan di
navbar — mencoba mengetik `/admin` langsung di address bar akan tetap diarahkan balik
ke `/sesi`.

## 2. Berkas BARU pada putaran ini

```
contexts/AuthContext.tsx          Sumber tunggal profil user & role (GET /users/me),
                                    dipasang di root App.tsx.
components/RequireRole.tsx        Guard TINGKAT ROUTE berbasis role, dipasang nested
                                    di dalam <ProtectedRoute/>.
pages/SessionsListPage.tsx        Halaman `/sesi` — landing non-admin, daftar sesi.
pages/SessionDetailPage.tsx       Halaman `/sesi/:sessionId` — tab Antrian Kasir +
                                    Riwayat Transaksi, keduanya ter-filter session_id.
```

## 3. Berkas yang DITULIS ULANG signifikan pada putaran ini

```
components/ProtectedRoute.tsx     Sekarang menahan render sampai AuthContext selesai
                                    memuat profil user (bukan cuma cek token).
pages/LoginPage.tsx                Redirect pasca-login berbasis role: admin -> /admin,
                                    lainnya -> /sesi. LoginForm.tsx TIDAK diubah/dikirim
                                    ulang (sudah ada di proyek Anda, tidak disentuh).
App.tsx                            AuthProvider dipasang di root. /admin/history DIHAPUS
                                    TOTAL. Route baru /sesi, /sesi/:sessionId. /admin &
                                    /admin/users digerbang RequireRole(["admin"]).
                                    /sesi/*, /admin/summary digerbang RequireRole(semua staf).
components/admin/AdminPage.tsx     Tab "Antrian Kasir" & "Sesi Operasional" DIHAPUS dari
                                    sini (pindah ke /sesi & /sesi/:sessionId). Tombol
                                    "Riwayat Transaksi" dihapus (halamannya sudah tidak
                                    ada). Sisa tab: Master Tiket, Audit Tiket, Akun Staf —
                                    murni admin-only sekarang. Pakai useAuth(), tidak
                                    fetch /users/me sendiri lagi.
components/admin/OperationalSessionManager.tsx
                                    Prop baru wajib: `onGoToDetail(sessionId)`. Tombol
                                    "Ke Detail Sesi" ditambahkan di modal (muncul begitu
                                    status != 'draft', termasuk tepat setelah "Buka Sesi"
                                    ditekan) dan di baris tabel. Field `st.sub_category`
                                    diperbaiki (lihat §5). Label master pakai
                                    `buildSubCategoryMasterMap(catalog)`.
components/admin/AdminDashboard.tsx
                                    Prop baru wajib: `sessionId`. Antrian pending difilter
                                    client-side ke `tx.session_id === sessionId`.
components/admin/ManualEntryModal.tsx
                                    PERUBAHAN BESAR: prop `sessionId` (bukan lagi
                                    `/sessions/active` global) — fetch `GET /sessions/{id}`
                                    spesifik, dan submit DIBLOK kalau status sesi itu bukan
                                    'opened'. Field `sub_category` diperbaiki. Nama Pemesan
                                    kini WAJIB (lihat §4).
components/admin/EditTransactionModal.tsx
                                    Nama Pemesan kini WAJIB diisi (lihat §4).
components/admin/AuditReportManager.tsx
                                    Field `sub_category` diperbaiki + fetch `/ticket-masters`
                                    untuk resolve nama master lewat `buildSubCategoryMasterMap`.
components/VisitorForm.tsx         Field `sub_category` diperbaiki. Input "Nama Pemesan"
                                    WAJIB ditambahkan (lihat §4) — form publik sebelumnya
                                    TIDAK punya field ini sama sekali.
types/index.ts                     `SessionTicket.sub_category` (bukan `ticket_sub_category`),
                                    `TransactionEntry.customer_name` & `session_id` jadi
                                    wajib/non-null, `TransactionCreatePayload.customer_name`
                                    wajib.
utils/formatters.ts                Fungsi baru `buildSubCategoryMasterMap(masters)` —
                                    menggantikan tebakan field yang salah di paket
                                    sebelumnya (`(sub as any).master_name || ...`).
```

## 4. Perubahan kontrak backend yang baru dikonfirmasi (dari `app/schema.py` asli)

Dua hal ini TIDAK sama dengan asumsi saya di paket pertama — sudah diperbaiki di semua
tempat pada paket ini:

1. **`customer_name` WAJIB diisi saat membuat transaksi**
   (`TransactionCreate.customer_name: str = Field(..., min_length=1)`).
   - `ManualEntryModal` (admin/kasir): field jadi wajib, tombol submit disabled tanpa isi.
   - `EditTransactionModal`: field jadi wajib saat edit juga.
   - `VisitorForm.tsx` (form publik pengunjung): **ditambahkan field baru** "Nama Pemesan"
     yang sebelumnya tidak ada sama sekali di form ini — kalau `TicketSelectionPage` atau
     halaman lain menyalin pola form ini, pastikan field ini ikut dibawa.

2. **`SessionTicketRead.sub_category`** (bukan `ticket_sub_category` seperti tebakan
   saya sebelumnya). Semua akses ke properti ini di `OperationalSessionManager`,
   `ManualEntryModal`, `AuditReportManager`, dan `VisitorForm` sudah diperbaiki ke
   `st.sub_category`.

3. **`TicketSubCategoryRead` tidak membawa nama master induknya** (dikonfirmasi dari
   schema — hanya ada `ticket_master_id`). Untuk halaman staf (yang boleh memanggil
   `GET /ticket-masters`), label "Nama Master — Nama Varian" sekarang dibangun lewat
   `buildSubCategoryMasterMap()` di `utils/formatters.ts`, bukan menebak field nested
   yang ternyata tidak ada. Untuk `VisitorForm.tsx` (publik, tidak boleh memanggil
   endpoint itu), pencocokan lantai terpilih disederhanakan menjadi HANYA lewat
   `ticket_master_id` (lihat §6 soal `TicketSelectionPage`).

## 5. Detail penting: `ManualEntryModal` sekarang per-sesi, bukan "sesi aktif global"

Sebelumnya, modal Tambah Manual selalu memanggil `GET /sessions/active` (sesi yang
sedang `opened` & jam sekarang ada di rentang sesi tsb). Ini SALAH kalau dipakai dari
halaman detail sesi tertentu — kalau kasir sedang membuka `/sesi/:sessionId` untuk sesi
A, tapi yang sedang aktif secara global adalah sesi B, tiket manual akan salah
tersimpan ke sesi B.

Sekarang `ManualEntryModal` menerima prop `sessionId` dan memanggil
`GET /sessions/{sessionId}` secara spesifik, lalu:
- Form di-disable total kalau `session.status !== 'opened'`, dengan pesan peringatan
  jelas ("Sesi ini berstatus 'draft'/'closed', tiket hanya bisa dibuat saat status
  'Dibuka'").
- Backend `POST /transactions` sendiri TIDAK menerima `session_id` sebagai parameter
  (ia selalu memakai `_get_active_session()` secara internal) — jadi transaksi yang
  dibuat lewat modal ini tetap akan masuk ke sesi yang SECARA BACKEND sedang aktif.
  **Ini berarti: kalau ada dua sesi 'opened' bertabrakan waktu di hari yang sama (mestinya
  tidak mungkin karena satu waktu cuma satu sesi bisa 'opened' dan match jendela waktu
  `_get_active_session`), atau kasir membuka halaman detail sesi yang BUKAN sesi yang
  sedang aktif secara waktu-nya, transaksi baru akan tetap nyasar ke sesi yang aktif
  secara global, bukan sesi yang sedang dilihat.** Frontend sudah mencegah kasus paling
  umum (sesi belum/sudah tidak berstatus 'opened' → form dikunci), tapi validasi
  "sessionId di URL == sesi yang backend anggap aktif sekarang" tidak bisa dijamin
  100% tanpa perubahan backend (mis. `POST /transactions` menerima `session_id`
  eksplisit dan memvalidasinya, alih-alih selalu menebak dari waktu sekarang). Kalau
  ini jadi masalah nyata di operasional, beri tahu saya — perubahan backend kecil bisa
  menutup celah ini sepenuhnya.

## 6. Dependensi yang masih belum bisa saya selesaikan

- **`TicketSelectionPage.tsx`** — masih belum pernah dikirim. `VisitorForm.tsx` sekarang
  mencocokkan `selectedFloors` HANYA lewat `ticket_master_id` (id asli, bukan nama
  string). `TicketSelectionPage` WAJIB mengirim id master tsb di
  `location.state.selectedFloors`, dan sumber datanya wajib `GET /sessions/active`
  (endpoint publik) — endpoint `/ticket-masters` tidak bisa dipanggil pengunjung
  (butuh login staf). Kirim file ini kalau mau saya sekalian selesaikan.
- **`SummaryPage.tsx`** — masih belum pernah dikirim. Dipanggil dari tab Riwayat
  Transaksi di `/sesi/:sessionId` lewat `navigate("/admin/summary", { state:
  { filteredTransactions, activeFilterLabel } })` — bentuk state yang dikirim TIDAK
  berubah dari sebelumnya, jadi kemungkinan besar masih kompatibel, tapi belum saya
  verifikasi langsung karena filenya sendiri tidak saya punya.

## 7. Berkas LAMA yang WAJIB DIHAPUS dari proyek Anda

Selain daftar dari paket pertama (`components/AdminDashboard.tsx` versi root,
`components/ManualEntryModal.tsx` / `EditTransactionModal.tsx` / `SuccessQueueModal.tsx`
versi root, `components/UserManagementComponent.tsx`, `components/AddUserModal.tsx`),
tambahkan:

- **`src/pages/PaymentHistoryPage.tsx`** — dihapus total dari paket ini (tidak ada lagi
  route `/admin/history`). Kalau masih ada di proyek Anda, hapus filenya juga supaya
  tidak ada import mati / kebingungan.

## 8. RBAC final (route level, bukan cuma UI)

| Route | Siapa boleh akses | Catatan |
|---|---|---|
| `/admin` | admin | `RequireRole(["admin"])` |
| `/admin/users` | admin | redirect ke tab Staf di `/admin` |
| `/sesi` | admin, kasir, checker | landing non-admin |
| `/sesi/:sessionId` | admin, kasir, checker | Antrian Kasir tab: konfirmasi/hapus tetap dibatasi per-aksi (lihat tabel lama) |
| `/admin/summary` | admin, kasir, checker | dipanggil dari tab Riwayat |

Pembatasan AKSI (bukan akses halaman) di dalam `/sesi/:sessionId` tidak berubah dari
sebelumnya: konfirmasi & edit transaksi → admin/kasir; hapus transaksi → admin saja;
isi audit & buka/tutup sesi → admin/kasir; buat sesi baru & CRUD master tiket → admin
saja (tombol-tombolnya otomatis tersembunyi untuk checker, dan backend menolak juga
kalau tetap dipaksa lewat API langsung).
