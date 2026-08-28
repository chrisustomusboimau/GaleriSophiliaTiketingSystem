# app/config.py
# ==========================================================
# KONFIGURASI TERPUSAT — Berbasis Pydantic Settings
# Disesuaikan dengan Skema Baru (Master Tiket Dinamis & Auth JWT)
# ==========================================================

from functools import lru_cache
from zoneinfo import ZoneInfo
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        case_sensitive=False,     # JWT_SECRET == jwt_secret
        extra="ignore",           # Abaikan key .env yang tidak terdefinisi di sini
    )

    # ----------------------------------------------------------
    # DATABASE
    # ----------------------------------------------------------
    # Wajib diisi di .env atau environment variable server (Railway/Supabase)
    database_url: str

    # Konfigurasi connection pool engine (Wajib 0 untuk Supabase / PgBouncer)
    db_pool_pre_ping: bool = True
    db_statement_cache_size: int = 0
    db_prepared_statement_cache_size: int = 0

    # ----------------------------------------------------------
    # APLIKASI
    # ----------------------------------------------------------
    app_timezone: str = "Asia/Jakarta"
    api_prefix: str = "/api/v1"
    max_queue_retry: int = 5

    # ----------------------------------------------------------
    # AUTHENTICATION & JWT (Digunakan oleh app/users.py)
    # ----------------------------------------------------------
    secret_key: str = "fallback_rahasia_lokal_galeria_123"
    jwt_secret: str = "fallback_rahasia_lokal_galeria_123"
    jwt_lifetime_seconds: int = 3600

    # ----------------------------------------------------------
    # CORS
    # ----------------------------------------------------------
    cors_origins: str = (
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "https://galeri-sophilia-tiketing-system.vercel.app"
    )

    # ----------------------------------------------------------
    # COMPUTED PROPERTIES
    # ----------------------------------------------------------

    @computed_field  # type: ignore[misc]
    @property
    def cors_origins_list(self) -> list[str]:
        """Parse string koma-separated dari .env menjadi list Python."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

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
        """
        url = self.database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", _ASYNCPG_PREFIX, 1)
        if url.startswith("postgresql://") and not url.startswith(_ASYNCPG_PREFIX):
            return url.replace("postgresql://", _ASYNCPG_PREFIX, 1)
        return url


# ----------------------------------------------------------
# SINGLETON
# ----------------------------------------------------------
@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Shortcut untuk import langsung
settings = get_settings()