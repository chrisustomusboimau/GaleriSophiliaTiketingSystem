# Galeri Sophilia Ticketing & Queue Management System

Sistem manajemen tiket museum terintegrasi yang mencakup antarmuka pengunjung (Kiosk), sistem manajemen antrean, dan Dashboard Admin (Kasir) dengan kendali penuh atas transaksi.

## Ringkasan Proyek
Proyek ini mengotomatisasi alur pembelian tiket museum. Fitur utamanya adalah fleksibilitas pemilihan multi-lantai dalam satu transaksi dengan tetap menjaga integritas data statistik melalui logika **Unique People Count**. Sistem ini menggunakan arsitektur asinkron untuk performa tinggi dan keamanan berbasis JWT.

---

## Fitur Utama

### Sisi Pengunjung
- **Dynamic Floor Selection**: Pilih kombinasi lantai (Floor 1, 5, 6/7) dengan harga agregat yang dihitung otomatis oleh server.
- **Smart Visitor Input**: Input jumlah orang (Anak, Remaja, Dewasa) dengan kontrol tombol `+/-` dan fitur *auto-select*.
- **Queue Number Generation**: Mendapatkan nomor antrean instan setelah data tersimpan di database.
- **Multi-language Support**: Tersedia dalam Bahasa Indonesia, English, dan Mandarin.

### Sisi Admin / Kasir
- **Live Monitoring Dashboard**: Memantau antrean berstatus `pending` secara real-time.
- **Manual Entry System**: Modal khusus bagi kasir untuk melayani pengunjung *walk-in* dengan alur pemilihan lantai yang cepat.
- **Transaction Management**: Konfirmasi pembayaran (`paid`), edit detail tiket, atau pembatalan transaksi (`cancelled`).
- **Unique Counting Logic**: Statistik yang akurat hanya menghitung **jumlah orang**, bukan jumlah tiket per lantai.
- **Export Excel**: Laporan transaksi mendetail yang dapat diunduh dalam format `.xlsx`.

---

## Stack Teknologi

### Frontend
- **Framework**: React 18 (TypeScript)
- **Styling**: Tailwind CSS
- **State Management**: React Hooks (useMemo, useCallback, useState)
- **Laporan**: ExcelJS & File-Saver

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: SQLite (Development) dengan SQLAlchemy Async (aiosqlite)
- **Security**: JWT Authentication (via FastAPI Users)
- **Timezone**: Asia/Jakarta (WIB)

---

## Demo
![Demo Video](./demo.mp4)

---

## API Endpoints (v1)

### Public (Visitor)
- `POST /api/v1/transactions`: Membuat transaksi baru & generate nomor antrean.
- `GET /api/v1/transactions/{id}`: Mengambil detail tiket spesifik.

### Admin (Auth Required)
- `GET /api/v1/transactions`: List semua transaksi (filter by status).
- `PATCH /api/v1/transactions/{id}/status`: Update status pembayaran.
- `PATCH /api/v1/transactions/{id}/edit`: Ubah detail tiket & kalkulasi ulang harga total di sisi server.
- `DELETE /api/v1/transactions/{id}`: Menghapus antrean permanen.

---

## Konfigurasi Harga (Server-Side)
Harga tiket dikelola sepenuhnya oleh server untuk keamanan:
- **Floor 6/7**: Adult (100k), Student (50k), Child (25k)
- **Floor 5**: Adult (40k), Student (20k), Child (10k)
- **Floor 1**: Adult (60k), Student (40k), Child (20k)

---

## Cara Menjalankan

### 1. Jalankan Backend
```bash
cd backend
# Buat virtual environment
python -m venv venv
source venv/bin/activate # atau venv\Scripts\activate di Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 2. Jalankan Frontend
```bash
cd frontend
npm install
npm run dev
```
