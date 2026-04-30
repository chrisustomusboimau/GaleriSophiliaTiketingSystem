import os
import uuid
from typing import Optional, List
from fastapi import Depends, Request, HTTPException, status
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy
)
from fastapi_users.db import SQLAlchemyUserDatabase
from app.db import User, get_user_db
from dotenv import load_dotenv

load_dotenv()

# AMAN UNTUK PRODUKSI: Ambil dari .env, berikan fallback HANYA untuk development lokal
SECRET = os.getenv("JWT_SECRET", "fallback_rahasia_lokal_galeria_123")

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def on_after_register(self, user, request: Optional[Request] = None):
        # UPDATE: Menampilkan role saat user baru mendaftar
        print(f"User {user.id} has registered with role: {user.role}.")

    async def on_after_forgot_password(self, user, token, request=None):
        print(f"User {user.id} has forgot their password. Reset token: {token}.")

    async def on_after_request_verify(self, user, token, request=None):
        print(f"Verification requested for user {user.id}. Verification token: {token}.")

async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)

bearer_transport = BearerTransport(tokenUrl="api/v1/auth/jwt/login")

def get_jwt_strategy():
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600)

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, auth_backends=[auth_backend])

# User dasar yang sedang login (semua role yang penting aktif)
current_active_user = fastapi_users.current_user(active=True)
optional_current_user = fastapi_users.current_user(active=True, optional=True)

# ==========================================
# ROLE-BASED DEPENDENCIES (PENJAGA PINTU)
# ==========================================

def require_role(allowed_roles: List[str]):
    """
    Fungsi pembuat dependency untuk membatasi endpoint berdasarkan role.
    Hanya user dengan role yang ada di daftar 'allowed_roles' yang bisa lewat.
    """
    async def role_checker(user: User = Depends(current_active_user)):
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Endpoint ini membutuhkan role: {', '.join(allowed_roles)}"
            )
        return user
    return role_checker

# --- DAFTAR PENJAGA PINTU YANG BISA DIGUNAKAN DI MAIN.PY ---

# 1. Hanya Admin
current_admin = require_role(["admin"])

# 2. Kasir (Admin juga biasanya diberi akses untuk fitur kasir)
current_kasir = require_role(["admin", "kasir"])

# 3. Checker (Admin juga diberi akses)
current_checker = require_role(["admin", "checker"])