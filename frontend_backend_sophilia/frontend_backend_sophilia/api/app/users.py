# app/users.py
# ==========================================================
# AUTHENTICATION & USER MANAGEMENT (fastapi-users)
# Disesuaikan dengan app/db.py, app/schema.py, & app/config.py
# ==========================================================

import uuid
from typing import List, Optional, Union
from fastapi import Depends, HTTPException, Request, status
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase

# Konfigurasi terpusat dan DB/Schema
from app.config import settings
from app.db import User, get_user_db
from app.schema import RoleEnum


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = getattr(settings, "jwt_secret", settings.secret_key)
    verification_token_secret = getattr(settings, "jwt_secret", settings.secret_key)

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered with role: {user.role}.")

    async def on_after_forgot_password(self, user: User, token: str, request: Optional[Request] = None):
        print(f"User {user.id} has forgot their password. Reset token: {token}.")

    async def on_after_request_verify(self, user: User, token: str, request: Optional[Request] = None):
        print(f"Verification requested for user {user.id}. Verification token: {token}.")


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


bearer_transport = BearerTransport(tokenUrl="api/v1/auth/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    secret = getattr(settings, "jwt_secret", settings.secret_key)
    lifetime = getattr(settings, "jwt_lifetime_seconds", 3600)
    return JWTStrategy(secret=secret, lifetime_seconds=lifetime)


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, auth_backends=[auth_backend])

# User dasar yang sedang login (semua role yang aktif)
current_active_user = fastapi_users.current_user(active=True)
optional_current_user = fastapi_users.current_user(active=True, optional=True)


# ==========================================
# ROLE-BASED DEPENDENCIES (PENJAGA PINTU)
# ==========================================

def require_role(allowed_roles: List[Union[RoleEnum, str]]):
    """
    Dependency generator untuk membatasi endpoint berdasarkan role.
    Mendukung input RoleEnum maupun String.
    """
    # Normalisasi daftar role ke string
    allowed_role_strings = [
        r.value if isinstance(r, RoleEnum) else str(r) for r in allowed_roles
    ]

    async def role_checker(user: User = Depends(current_active_user)) -> User:
        user_role_str = user.role.value if isinstance(user.role, RoleEnum) else str(user.role)
        if user_role_str not in allowed_role_strings:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Endpoint ini membutuhkan role: {', '.join(allowed_role_strings)}"
            )
        return user

    return role_checker


# --- DAFTAR PENJAGA PINTU YANG BISA DIGUNAKAN DI ROUTER/MAIN.PY ---

# 1. Hanya Admin
current_admin = require_role([RoleEnum.admin])

# 2. Kasir (Admin juga diberi akses)
current_kasir = require_role([RoleEnum.admin, RoleEnum.kasir])

# 3. Checker (Admin juga diberi akses)
current_checker = require_role([RoleEnum.admin, RoleEnum.checker])