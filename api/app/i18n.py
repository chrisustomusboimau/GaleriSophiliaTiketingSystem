# app/i18n.py
# ==========================================================
# SUMBER TUNGGAL ATURAN MULTI-BAHASA (i18n) UNTUK NAMA TIKET
#
# Nama Master Tiket & Sub-Kategori sekarang disimpan sebagai objek JSONB
# `name_i18n`, contoh:
#
#     {"id": "Tiket Lantai 1", "en": "Floor 1 Ticket", "zh": "1层门票"}
#
# ATURAN BISNIS:
# - `id` (Bahasa Indonesia) dan `en` (English) WAJIB diisi admin.
# - `zh` (Mandarin) OPSIONAL — kalau kosong, pengunjung berbahasa Mandarin
#   otomatis melihat nama versi English (lihat FALLBACK_CHAIN di bawah).
# - HARGA TIDAK PERNAH ikut diterjemahkan — harga tetap satu nilai
#   universal di kolom `price`, apapun bahasanya.
#
# File ini dipakai bersama oleh app/schema.py (validasi input admin) dan
# app/app.py (penulisan kolom cermin `name` + snapshot transaksi), supaya
# aturan locale tidak tersebar & tidak pernah berbeda antar layer.
# ==========================================================

from typing import Dict, Iterable, Mapping, Optional

# Semua locale yang dikenal aplikasi. Harus selaras dengan tipe `Language`
# di src/contexts/LanguageContext.tsx ("id" | "en" | "zh").
SUPPORTED_LOCALES = ("id", "en", "zh")

# Locale yang WAJIB ada & tidak boleh kosong pada setiap nama tiket.
REQUIRED_LOCALES = ("id", "en")

# Locale cadangan bila locale yang diminta tidak tersedia. Dibaca kiri ke
# kanan; entri pertama yang ada isinya yang dipakai. Versi frontend dari
# tabel yang sama ada di `resolveName()` (src/utils/formatters.ts) — kalau
# salah satu diubah, ubah keduanya.
FALLBACK_CHAIN: Dict[str, tuple] = {
    "id": ("id", "en"),
    "en": ("en", "id"),
    "zh": ("zh", "en", "id"),
}

# Pemisah antara nama master & nama varian pada snapshot transaksi
# ("Tiket Lantai 1 - Dewasa"). Dipakai juga oleh splitTicketSnapshot() di
# frontend — JANGAN diubah tanpa mengubah parser di sana.
SNAPSHOT_SEPARATOR = " - "


def normalize_name_i18n(raw: Optional[Mapping[str, object]]) -> Dict[str, str]:
    """
    Membersihkan & memvalidasi objek nama multi-bahasa dari admin.

    - Membuang spasi di awal/akhir setiap nilai.
    - Membuang locale yang nilainya kosong (mis. `zh` yang tidak diisi).
    - Menolak locale di luar SUPPORTED_LOCALES.
    - Menolak kalau `id` atau `en` tidak ada / kosong.

    Melempar ValueError, sehingga saat dipakai sebagai Pydantic
    AfterValidator, FastAPI otomatis membalas 422 (bukan 500).
    """
    if raw is None or not isinstance(raw, Mapping):
        raise ValueError("Nama tiket harus berupa objek per bahasa, contoh: {'id': '...', 'en': '...'}")

    cleaned: Dict[str, str] = {}
    for locale, value in raw.items():
        key = str(locale).strip().lower()
        if key not in SUPPORTED_LOCALES:
            raise ValueError(
                f"Bahasa '{locale}' tidak didukung. Pilihan yang tersedia: {', '.join(SUPPORTED_LOCALES)}."
            )
        text = str(value).strip() if value is not None else ""
        if text:
            cleaned[key] = text

    missing = [loc for loc in REQUIRED_LOCALES if not cleaned.get(loc)]
    if missing:
        label = {"id": "Bahasa Indonesia (id)", "en": "English (en)"}
        raise ValueError(
            "Nama tiket wajib diisi dalam " + " dan ".join(label.get(m, m) for m in missing) + "."
        )

    return cleaned


def resolve_name(names: Optional[Mapping[str, str]], lang: str, fallback: str = "") -> str:
    """
    Mengambil nama untuk satu bahasa, mengikuti FALLBACK_CHAIN.
    Tidak pernah mengembalikan string kosong selama `id`/`en` terisi.
    """
    if not names:
        return fallback

    chain: Iterable[str] = FALLBACK_CHAIN.get(str(lang).lower(), FALLBACK_CHAIN["id"])
    for locale in chain:
        text = (names.get(locale) or "").strip()
        if text:
            return text

    # Jaring pengaman terakhir: locale apa pun yang kebetulan terisi.
    for value in names.values():
        text = (value or "").strip()
        if text:
            return text

    return fallback


def build_snapshot_i18n(
    master_names: Optional[Mapping[str, str]],
    sub_names: Optional[Mapping[str, str]],
) -> Dict[str, str]:
    """
    Membentuk snapshot nama tiket multi-bahasa untuk disimpan permanen di
    `transaction_items.ticket_name_snapshot_i18n`, mis.:

        {"id": "Tiket Lantai 1 - Dewasa", "en": "Floor 1 Ticket - Adult"}

    Snapshot dibekukan saat transaksi dibuat — kalau admin mengubah nama
    tiket besok, struk & riwayat lama tetap menampilkan nama saat dibeli
    (sama persis dengan alasan kolom `ticket_name_snapshot` lama ada).

    `id` & `en` DIJAMIN ada (keduanya wajib di master maupun varian).
    `zh` hanya ikut kalau kedua sisi punya versi Mandarin-nya; kalau tidak,
    pembaca akan jatuh ke `en` lewat resolve_name().
    """
    snapshot: Dict[str, str] = {}
    for locale in SUPPORTED_LOCALES:
        sub_text = (sub_names or {}).get(locale, "").strip() if sub_names else ""
        if not sub_text:
            continue
        # Nama master di-resolve lewat fallback chain (bukan lookup persis),
        # supaya snapshot Mandarin tetap membawa prefix master walau master
        # belum punya nama Mandarin: "Floor 1 Ticket - 成人". Tanpa prefix,
        # QueueDisplay yang mengelompokkan struk per master akan meleburkan
        # semua lantai jadi satu grup.
        master_text = resolve_name(master_names, locale)
        snapshot[locale] = f"{master_text}{SNAPSHOT_SEPARATOR}{sub_text}" if master_text else sub_text

    # Pastikan locale wajib selalu terisi walau data lama tidak lengkap.
    for locale in REQUIRED_LOCALES:
        if not snapshot.get(locale):
            fallback_sub = resolve_name(sub_names, locale)
            fallback_master = resolve_name(master_names, locale)
            if fallback_sub:
                snapshot[locale] = (
                    f"{fallback_master}{SNAPSHOT_SEPARATOR}{fallback_sub}" if fallback_master else fallback_sub
                )

    return snapshot
