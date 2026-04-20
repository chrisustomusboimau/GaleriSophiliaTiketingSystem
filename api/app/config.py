# app/config.py
# ==========================================================
# KONFIGURASI TERPUSAT — Berbasis Pydantic Settings
#
# Cara kerja:
#   1. Nilai dibaca dari file `.env` (untuk lokal/dev)
#   2. Nilai bisa di-override langsung via environment variable
#      (untuk production: Railway, Render, Docker, dsb.)
#   3. Semua nilai divalidasi tipenya secara otomatis oleh Pydantic.
#
# Dependensi: pip install pydantic-settings
# ==========================================================

from functools import lru_cache
from typing import Dict
from pydantic import field_validator, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from zoneinfo import ZoneInfo


# Prefix URL yang valid untuk asyncpg
_ASYNCPG_PREFIX = "postgresql+asyncpg://"


class Settings(BaseSettings):
    """
    Semua konfigurasi aplikasi dibaca dari environment variable
    atau file `.env` secara otomatis.
    """

    model_config = SettingsConfigDict(
        env_file=".env",          # Baca dari file .env di root project
        env_file_encoding="utf-8",
        case_sensitive=False,     # PRICE_FLOOR67_ADULT == price_floor67_adult
        extra="ignore",           # Abaikan key .env yang tidak terdefinisi di sini
    )

    # ----------------------------------------------------------
    # DATABASE
    # ----------------------------------------------------------
    # Wajib diisi di .env atau environment variable server (Railway, dll.)
    # Tidak ada default — aplikasi akan crash saat startup jika tidak diisi,
    # sehingga kesalahan konfigurasi terdeteksi lebih awal.
    database_url: str

    # Konfigurasi connection pool engine — aman untuk diubah tanpa deploy ulang
    db_pool_pre_ping: bool = True
    db_statement_cache_size: int = 0           # Wajib 0 untuk Supabase / PgBouncer
    db_prepared_statement_cache_size: int = 0  # Wajib 0 untuk Supabase / PgBouncer

    # ----------------------------------------------------------
    # APLIKASI
    # ----------------------------------------------------------
    app_timezone: str = "Asia/Jakarta"
    api_prefix: str = "/api/v1"
    max_queue_retry: int = 5

    # ----------------------------------------------------------
    # CORS
    # ----------------------------------------------------------
    # Di file .env, tulis sebagai string dipisah koma:
    # CORS_ORIGINS="http://localhost:5173,https://yourdomain.com"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://galeri-sophilia-tiketing-system.vercel.app"
 

    # ----------------------------------------------------------
    # HARGA TIKET — Floor 6/7
    # ----------------------------------------------------------
    price_floor67_adult: int = 100000
    price_floor67_student: int = 50000
    price_floor67_child: int = 25000

    # ----------------------------------------------------------
    # HARGA TIKET — Floor 5
    # ----------------------------------------------------------
    price_floor5_adult: int = 40000
    price_floor5_student: int = 20000
    price_floor5_child: int = 10000

    # ----------------------------------------------------------
    # HARGA TIKET — Floor 1
    # ----------------------------------------------------------
    price_floor1_adult: int = 60000
    price_floor1_student: int = 40000
    price_floor1_child: int = 20000

    # ----------------------------------------------------------
    # COMPUTED PROPERTIES
    # Nilai-nilai turunan yang tidak perlu ditulis di .env,
    # tapi dihitung otomatis dari nilai di atas.
    # ----------------------------------------------------------

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse string koma-separated dari .env menjadi list Python."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @computed_field  # type: ignore[misc]
    @property
    def timezone(self) -> ZoneInfo:
        """Objek ZoneInfo siap pakai, dibuat dari string app_timezone."""
        return ZoneInfo(self.app_timezone)

    @computed_field  # type: ignore[misc]
    @property
    def database_url_async(self) -> str:
        """
        Normalisasi DATABASE_URL agar selalu menggunakan driver asyncpg.
        Supabase / Railway kadang memberikan URL berawalan 'postgres://' atau
        'postgresql://' — keduanya dikonversi otomatis di sini sehingga
        db.py tidak perlu mengandung logika transformasi URL sama sekali.
        """
        url = self.database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", _ASYNCPG_PREFIX, 1)
        if url.startswith("postgresql://") and not url.startswith(_ASYNCPG_PREFIX):
            return url.replace("postgresql://", _ASYNCPG_PREFIX, 1)
        return url  # Sudah benar (misal: saat diisi manual dengan prefix asyncpg)

    @computed_field  # type: ignore[misc]
    @property
    def prices_map(self) -> Dict[str, Dict[str, int]]:
        """
        Rekonstruksi PRICES_MAP dalam format yang sama persis dengan kode lama,
        sehingga semua logika validasi di endpoint tidak perlu diubah.
        """
        return {
            "Floor 6/7": {
                "adult":   self.price_floor67_adult,
                "student": self.price_floor67_student,
                "child":   self.price_floor67_child,
            },
            "Floor 5": {
                "adult":   self.price_floor5_adult,
                "student": self.price_floor5_student,
                "child":   self.price_floor5_child,
            },
            "Floor 1": {
                "adult":   self.price_floor1_adult,
                "student": self.price_floor1_student,
                "child":   self.price_floor1_child,
            },
        }


# ----------------------------------------------------------
# SINGLETON — Gunakan fungsi ini di seluruh aplikasi
#
# @lru_cache() memastikan objek Settings hanya dibuat SATU KALI
# selama aplikasi berjalan (tidak re-parse .env di setiap request).
# ----------------------------------------------------------
@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Shortcut untuk import langsung jika dibutuhkan
settings = get_settings()