from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager
from sqlalchemy import select, func, delete
import uuid
from typing import List, Optional
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta, date
from pydantic import BaseModel, EmailStr
from fastapi_users.password import PasswordHelper

from app.config import settings

from app.schema import (
    UserCreate, UserRead, UserUpdate,
    TransactionCreate, TransactionResponse, TransactionStatusUpdate,
    TransactionUpdateData,
    TicketMasterCreate, TicketMasterRead, TicketMasterUpdate,
    TicketSubCategoryCreate, TicketSubCategoryRead, TicketSubCategoryUpdate,
    OperationalSessionCreate, OperationalSessionRead, OperationalSessionUpdate,
    SessionTicketAuditRead, SessionTicketAuditStartUpdate, SessionTicketAuditEndUpdate,
    SessionTicketAuditBulkUpdate,
    ActiveSessionStatusRead,
)
from app.i18n import build_snapshot_i18n
from app.db import (
    create_db_and_tables, get_async_session, User,
    TransactionEntry, TransactionOriginEntry, TransactionItem,
    TicketMaster, TicketSubCategory,
    OperationalSession, SessionTicket, SessionTicketAudit,
)

from app.users import auth_backend, fastapi_users, require_role

# ----------------------------------------------------------
# INISIALISASI PENJAGA PINTU
# ----------------------------------------------------------
current_admin   = require_role(["admin"])
current_kasir   = require_role(["admin", "kasir"])
current_checker = require_role(["admin", "kasir", "checker"])


PREFIX = settings.api_prefix   # "/api/v1"
WIB    = settings.timezone     # ZoneInfo("Asia/Jakarta")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

_password_helper = PasswordHelper()

# ==========================================
# CORS MIDDLEWARE
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# AUTHENTICATION ROUTERS
# ==========================================
# 1. PUBLIC: Login & Reset Password bisa diakses siapa saja
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix=f"{PREFIX}/auth/jwt", tags=["auth"])
app.include_router(fastapi_users.get_reset_password_router(),   prefix=f"{PREFIX}/auth",     tags=["auth"])
app.include_router(fastapi_users.get_verify_router(UserRead),   prefix=f"{PREFIX}/auth",     tags=["auth"])

# 2. RESTRICTED: Pendaftaran hanya untuk Admin
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"{PREFIX}/auth",
    tags=["auth-admin"],
    dependencies=[Depends(current_admin)]
)

# Rute standar users dari fastapi-users (hanya bisa /me atau /id).
# CATATAN: sengaja TIDAK diberi dependencies=[Depends(current_admin)] di
# level router ini, karena itu akan memblokir GET/PATCH /users/me untuk
# kasir & checker (setiap staf harus bisa melihat profilnya sendiri).
# Endpoint admin-only (list semua user, update/delete user lain) sudah
# masing-masing punya Depends(current_admin) sendiri di bawah.
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix=f"{PREFIX}/users",
    tags=["users-admin"])

# ==========================================
# CUSTOM USER ROUTER: GET ALL USERS (HANYA ADMIN)
# ==========================================
class UserUpdatePayload(BaseModel):
    """Payload untuk update akun staf oleh Admin."""
    email:     Optional[EmailStr] = None
    role:      Optional[str]      = None
    is_active: Optional[bool]     = None
    password:  Optional[str]      = None

@app.patch(f"{PREFIX}/users/{{user_id}}/update", response_model=UserRead, tags=["users-admin"])
async def update_user_by_admin(
    user_id: uuid.UUID,
    payload: UserUpdatePayload,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Mengubah email, role, status aktif, atau password akun staf."""
    result = await session.execute(select(User).where(User.id == user_id))
    target = result.scalars().first()

    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    if payload.email is not None and payload.email != target.email:
        existing = await session.execute(
            select(User).where(User.email == payload.email)
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Email sudah digunakan oleh akun lain.")
        target.email = payload.email

    if payload.role is not None:
        valid_roles = {"admin", "kasir", "checker"}
        if payload.role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Role tidak valid. Pilih dari: {valid_roles}")
        target.role = payload.role

    if payload.is_active is not None:
        target.is_active = payload.is_active

    if payload.password is not None:
        if len(payload.password) < 8:
            raise HTTPException(status_code=400, detail="Password minimal 8 karakter.")

        target.hashed_password = _password_helper.hash(payload.password)

    try:
        await session.commit()
        await session.refresh(target)
        return target
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan perubahan: {e}")


# ==========================================
# CUSTOM USER ROUTER: DELETE USER (HANYA ADMIN)
# ==========================================

@app.delete(f"{PREFIX}/users/{{user_id}}/delete", tags=["users-admin"])
async def delete_user_by_admin(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Menghapus akun staf secara permanen."""
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun Anda sendiri.")

    result = await session.execute(select(User).where(User.id == user_id))
    target = result.scalars().first()

    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan.")

    try:
        await session.delete(target)
        await session.commit()
        return {"success": True, "message": f"Akun {target.email} berhasil dihapus."}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menghapus akun: {e}")


@app.get(f"{PREFIX}/users", response_model=List[UserRead], tags=["users-admin"])
async def list_all_users(
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_admin)
):
    """ADMIN: Mengambil daftar seluruh staf (admin, kasir, checker)."""
    try:
        result = await session.execute(select(User))
        users = result.scalars().all()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {e}")


# ==========================================
# TICKET MASTER (ADMIN)
# ==========================================

@app.post(f"{PREFIX}/ticket-masters", response_model=TicketMasterRead, status_code=201, tags=["ticket-master"])
async def create_ticket_master(
    payload: TicketMasterCreate,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Membuat master tiket baru beserta sub-kategorinya (opsional).

    Nama dikirim per bahasa lewat `name_i18n` (ID & EN wajib, ZH opsional —
    divalidasi di app/schema.py). Kolom `name` diisi otomatis dari versi
    Bahasa Indonesia sebagai CERMIN: itu yang menjaga UNIQUE constraint dan
    yang dipakai seluruh laporan staf. Jangan pernah mengisi `name` tanpa
    ikut mengisi `name_i18n`."""
    id_name = payload.name_i18n["id"]

    # Cek duplikat dilakukan pada cermin Bahasa Indonesia — sama seperti
    # sebelum multi-bahasa; nama English tidak diwajibkan unik.
    existing = await session.execute(select(TicketMaster).where(TicketMaster.name == id_name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Nama master tiket sudah digunakan.")

    # Konstruksi eksplisit (bukan **sc.dict()) karena setiap baris butuh
    # DUA field turunan: name_i18n dan cerminnya, name.
    new_master = TicketMaster(
        name=id_name,
        name_i18n=payload.name_i18n,
        description=payload.description,
        sub_categories=[
            TicketSubCategory(
                name=sc.name_i18n["id"],
                name_i18n=sc.name_i18n,
                min_age=sc.min_age,
                max_age=sc.max_age,
                price=sc.price,
            )
            for sc in payload.sub_categories
        ],
    )
    session.add(new_master)
    try:
        await session.commit()
        await session.refresh(new_master)
        return new_master
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal membuat master tiket: {e}")


@app.get(f"{PREFIX}/ticket-masters", response_model=List[TicketMasterRead], tags=["ticket-master"])
async def list_ticket_masters(
    include_inactive: bool = Query(
        False,
        description="Jika true, sertakan juga master & sub-kategori yang sudah dinonaktifkan (soft-deleted). "
                    "Dipakai halaman manajemen admin; pilihan tiket baru (sesi/kasir) selalu default false."
    ),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker),
):
    """STAFF: Melihat seluruh master tiket & sub-kategorinya.
    Default HANYA menampilkan yang masih aktif (is_active=True), supaya
    tiket yang sudah "dihapus" (soft-deleted) tidak lagi muncul sebagai
    pilihan saat membuat sesi baru atau transaksi manual."""
    query = select(TicketMaster).order_by(TicketMaster.name.asc())
    if not include_inactive:
        query = query.where(TicketMaster.is_active.is_(True))

    result = await session.execute(query)
    masters = result.scalars().unique().all()

    if include_inactive:
        return masters

    # Bangun response secara eksplisit (bukan memutasi relasi ORM) supaya
    # sub-kategori yang sudah dinonaktifkan ikut tersaring meskipun master
    # induknya masih aktif, tanpa efek samping ke session/identity map.
    return [
        TicketMasterRead(
            id=m.id,
            name=m.name,
            name_i18n=m.name_i18n,      # tanpa ini, jalur "hanya yang aktif"
                                        # akan mengembalikan nama kosong
            description=m.description,
            is_active=m.is_active,
            sub_categories=[
                TicketSubCategoryRead.model_validate(sc) for sc in m.sub_categories if sc.is_active
            ],
        )
        for m in masters
    ]


@app.patch(f"{PREFIX}/ticket-masters/{{ticket_master_id}}", response_model=TicketMasterRead, tags=["ticket-master"])
async def update_ticket_master(
    ticket_master_id: uuid.UUID,
    payload: TicketMasterUpdate,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Mengubah nama/deskripsi master tiket, atau mengaktifkan
    kembali (`is_active: true`) master yang sebelumnya dinonaktifkan."""
    result = await session.execute(select(TicketMaster).where(TicketMaster.id == ticket_master_id))
    master = result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="Master tiket tidak ditemukan.")

    if payload.name_i18n is not None:
        # Tulis keduanya bersamaan agar cermin tidak pernah menyimpang.
        master.name_i18n = payload.name_i18n
        master.name = payload.name_i18n["id"]
    if payload.description is not None:
        master.description = payload.description
    if payload.is_active is not None:
        master.is_active = payload.is_active

    try:
        await session.commit()
        await session.refresh(master)
        return master
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengubah master tiket: {e}")


@app.delete(f"{PREFIX}/ticket-masters/{{ticket_master_id}}", tags=["ticket-master"])
async def delete_ticket_master(
    ticket_master_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Menonaktifkan (SOFT DELETE) master tiket beserta seluruh
    sub-kategorinya. TIDAK PERNAH menjalankan DELETE FROM lagi — riwayat
    transaksi lama yang masih mereferensikan sub-kategori di bawah master
    ini (transaction_items) tetap aman & konsisten. Master & sub-kategori
    yang dinonaktifkan otomatis hilang dari pilihan tiket baru, tapi tetap
    tampil apa adanya pada sesi/transaksi lama."""
    result = await session.execute(select(TicketMaster).where(TicketMaster.id == ticket_master_id))
    master = result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="Master tiket tidak ditemukan.")

    master.is_active = False
    for sub in master.sub_categories:
        sub.is_active = False

    try:
        await session.commit()
        return {"success": True, "message": f"Master tiket '{master.name}' berhasil dinonaktifkan."}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menonaktifkan master tiket: {e}")


# ==========================================
# TICKET SUB CATEGORY (ADMIN)
# ==========================================

@app.post(
    f"{PREFIX}/ticket-masters/{{ticket_master_id}}/sub-categories",
    response_model=TicketSubCategoryRead,
    status_code=201,
    tags=["ticket-master"]
)
async def add_ticket_sub_category(
    ticket_master_id: uuid.UUID,
    payload: TicketSubCategoryCreate,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Menambahkan varian usia & harga baru ke master tiket."""
    result = await session.execute(select(TicketMaster).where(TicketMaster.id == ticket_master_id))
    master = result.scalars().first()
    if not master:
        raise HTTPException(status_code=404, detail="Master tiket tidak ditemukan.")

    if payload.max_age is not None and payload.max_age < payload.min_age:
        raise HTTPException(status_code=400, detail="max_age tidak boleh lebih kecil dari min_age.")

    new_sub = TicketSubCategory(
        ticket_master_id=ticket_master_id,
        name=payload.name_i18n["id"],      # cermin Bahasa Indonesia
        name_i18n=payload.name_i18n,
        min_age=payload.min_age,
        max_age=payload.max_age,
        price=payload.price,
    )
    session.add(new_sub)
    try:
        await session.commit()
        await session.refresh(new_sub)
        return new_sub
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menambahkan sub-kategori: {e}")


@app.patch(f"{PREFIX}/ticket-sub-categories/{{sub_category_id}}", response_model=TicketSubCategoryRead, tags=["ticket-master"])
async def update_ticket_sub_category(
    sub_category_id: uuid.UUID,
    payload: TicketSubCategoryUpdate,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Mengubah nama/rentang usia/harga sub-kategori tiket, atau
    mengaktifkan kembali (`is_active: true`) sub-kategori yang sebelumnya
    dinonaktifkan."""
    result = await session.execute(select(TicketSubCategory).where(TicketSubCategory.id == sub_category_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sub-kategori tiket tidak ditemukan.")

    if payload.name_i18n is not None:
        sub.name_i18n = payload.name_i18n
        sub.name = payload.name_i18n["id"]
    if payload.min_age is not None:
        sub.min_age = payload.min_age
    if payload.max_age is not None:
        sub.max_age = payload.max_age
    if payload.price is not None:
        sub.price = payload.price
    if payload.is_active is not None:
        sub.is_active = payload.is_active

    try:
        await session.commit()
        await session.refresh(sub)
        return sub
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal mengubah sub-kategori: {e}")


@app.delete(f"{PREFIX}/ticket-sub-categories/{{sub_category_id}}", tags=["ticket-master"])
async def delete_ticket_sub_category(
    sub_category_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Menonaktifkan (SOFT DELETE) sub-kategori tiket.

    PERBAIKAN BUG: sebelumnya endpoint ini menjalankan `DELETE FROM`
    langsung, yang gagal dengan ForeignKeyViolationError kalau
    sub-kategori tsb masih direferensikan oleh transaction_items (riwayat
    transaksi). Sekarang TIDAK PERNAH menghapus baris — hanya mengubah
    `is_active = False`, sehingga:
      1) Bug FK di atas tidak akan pernah terjadi lagi lewat endpoint ini.
      2) Riwayat transaksi & laporan keuangan/audit lama tetap 100% utuh.
      3) Sub-kategori otomatis hilang dari pilihan tiket baru (kasir/sesi),
         tapi admin masih bisa mengaktifkannya kembali lewat PATCH di atas.
    """
    result = await session.execute(select(TicketSubCategory).where(TicketSubCategory.id == sub_category_id))
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="Sub-kategori tiket tidak ditemukan.")

    sub.is_active = False
    try:
        await session.commit()
        return {"success": True, "message": f"Sub-kategori '{sub.name}' berhasil dinonaktifkan."}
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menonaktifkan sub-kategori: {e}")


# ==========================================
# OPERATIONAL SESSION (ADMIN membuat & mengelola siklus hidup sesi)
# ==========================================

async def _assert_no_session_overlap(
    session: AsyncSession,
    session_date: date,
    start_time,
    end_time,
    exclude_id: Optional[uuid.UUID] = None,
) -> None:
    """
    Menolak jadwal sesi yang bertabrakan dengan sesi lain di TANGGAL YANG SAMA.

    Ini adalah SATU-SATUNYA tempat aturan anti-tumpang-tindih ditegakkan —
    endpoint pembuatan/perubahan sesi apa pun di masa depan harus memanggil
    fungsi ini (dengan `exclude_id` diisi saat mengedit sesi yang sudah ada).

    Dua aturan yang menentukan hasilnya:

    1) SEMUA STATUS ikut dihitung (draft, opened, maupun closed). Sesi draft
       bisa dibuka kapan saja, dan sesi closed tetap "memakai" slot waktunya
       di jadwal hari itu — jadi keduanya tetap memblokir jadwal baru.

    2) Rentang bersifat HALF-OPEN [start, end): sesi bersebelahan persis
       (12:00–16:00 lalu 16:00–20:00) DIPERBOLEHKAN. Dua rentang dianggap
       bertabrakan hanya kalau benar-benar beririsan:
           existing.start < new.end  AND  existing.end > new.start
       Aturan half-open yang sama dipakai `OperationalSession.is_live` dan
       `_get_active_session()`, sehingga pada pukul 16:00 tepat hanya ada
       SATU sesi yang aktif.
    """
    query = select(OperationalSession).where(
        OperationalSession.date == session_date,
        OperationalSession.start_time < end_time,
        OperationalSession.end_time > start_time,
    )
    if exclude_id is not None:
        query = query.where(OperationalSession.id != exclude_id)

    result = await session.execute(query)
    conflict = result.scalars().first()
    if conflict:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Jadwal bertabrakan dengan sesi '{conflict.name}' "
                f"({conflict.start_time.strftime('%H:%M')}–{conflict.end_time.strftime('%H:%M')}) "
                f"pada tanggal yang sama. Sesi tidak boleh tumpang-tindih; "
                f"jadwal yang bersambung persis (mis. 12:00–16:00 lalu 16:00–20:00) diperbolehkan."
            ),
        )


@app.post(f"{PREFIX}/sessions", response_model=OperationalSessionRead, status_code=201, tags=["sessions"])
async def create_operational_session(
    payload: OperationalSessionCreate,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),
):
    """ADMIN: Membuat sesi operasional & mengaktifkan daftar tiket yang dijual pada sesi tersebut."""
    if payload.end_time <= payload.start_time:
        raise HTTPException(status_code=400, detail="end_time harus lebih besar dari start_time.")

    await _assert_no_session_overlap(session, payload.date, payload.start_time, payload.end_time)

    session_tickets = []
    for sub_id in payload.ticket_sub_category_ids:
        sub_result = await session.execute(select(TicketSubCategory).where(TicketSubCategory.id == sub_id))
        sub = sub_result.scalars().first()
        if not sub:
            raise HTTPException(status_code=400, detail=f"Sub-kategori tiket {sub_id} tidak ditemukan.")
        # BARU: cegah sesi baru dibuat dengan tiket yang sudah dinonaktifkan.
        if not sub.is_active:
            raise HTTPException(
                status_code=400,
                detail=f"Sub-kategori tiket '{sub.name}' sudah dinonaktifkan dan tidak bisa dipakai di sesi baru."
            )
        session_tickets.append(SessionTicket(
            ticket_sub_category_id=sub_id,
            audit=SessionTicketAudit()
        ))

    new_session = OperationalSession(
        name=payload.name,
        date=payload.date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="draft",
        active_tickets=session_tickets
    )
    session.add(new_session)
    try:
        await session.commit()
        # Re-query (bukan refresh) agar relasi bertingkat (active_tickets -> sub_category ->
        # ticket_master, dan active_tickets -> audit) ikut termuat dengan benar oleh strategi
        # lazy="selectin" sebelum diserialisasi ke response model.
        result = await session.execute(
            select(OperationalSession).where(OperationalSession.id == new_session.id)
        )
        return result.scalars().first()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Ada sub-kategori tiket yang diaktifkan lebih dari satu kali.")
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal membuat sesi: {e}")


@app.get(f"{PREFIX}/sessions", response_model=List[OperationalSessionRead], tags=["sessions"])
async def list_operational_sessions(
    date_filter: Optional[date] = Query(None, alias="date", description="Filter tanggal, format YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="Filter status: draft, opened, closed"),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker),
):
    """STAFF: Daftar sesi operasional.

    CATATAN RBAC (ditegakkan di FRONTEND, bukan di sini): kasir & checker
    hanya diperlihatkan sesi berstatus 'opened' oleh UI (frontend selalu
    mengirim ?status=opened untuk mereka). Endpoint ini sendiri tetap bisa
    menampilkan semua status untuk siapa pun yang lolos `current_checker`,
    supaya tidak menduplikasi logika role di banyak tempat — kalau ingin
    proteksi ini digaris-bawahi juga di backend, beri tahu saya."""
    query = select(OperationalSession).order_by(
        OperationalSession.date.desc(), OperationalSession.start_time.asc()
    )
    if date_filter:
        query = query.where(OperationalSession.date == date_filter)
    if status:
        query = query.where(OperationalSession.status == status)

    result = await session.execute(query)
    return result.scalars().unique().all()


async def _find_active_session(session: AsyncSession) -> Optional[OperationalSession]:
    """
    Mengambil sesi yang sedang berjalan saat ini (WIB), atau None.

    Sesi dianggap berjalan kalau SUDAH DIBUKA admin ('opened'), tanggalnya
    hari ini, dan jam sekarang ada di dalam rentangnya.

    PERBAIKAN: batas akhir sekarang EKSKLUSIF (`end_time > now`), dulu
    inklusif (`>=`). Dengan dua sesi bersebelahan 12:00–16:00 dan
    16:00–20:00, versi lama membuat KEDUANYA cocok tepat pukul 16:00 dan
    `.first()` memilih salah satu secara sembarang. Sekarang persis satu
    sesi yang cocok kapan pun. Aturan half-open ini identik dengan
    `OperationalSession.is_live` dan `_assert_no_session_overlap`.
    """
    now_wib = datetime.now(WIB)
    result = await session.execute(
        select(OperationalSession).where(
            OperationalSession.date == now_wib.date(),
            OperationalSession.status == "opened",
            OperationalSession.start_time <= now_wib.time(),
            OperationalSession.end_time > now_wib.time(),
        )
    )
    return result.scalars().first()


async def _get_active_session(session: AsyncSession) -> OperationalSession:
    """Sama seperti `_find_active_session`, tapi melempar 403 kalau tidak ada.
    Dipakai jalur yang memang harus gagal (mis. pembuatan transaksi)."""
    active = await _find_active_session(session)
    if not active:
        raise HTTPException(
            status_code=403,
            detail="Tidak ada sesi operasional yang sedang dibuka saat ini. Silakan coba lagi nanti."
        )
    return active


@app.get(f"{PREFIX}/sessions/active", response_model=OperationalSessionRead, tags=["sessions"])
async def get_active_operational_session(
    session: AsyncSession = Depends(get_async_session),
):
    """PUBLIC: Mengambil sesi yang sedang berjalan & 'opened' saat ini (untuk halaman checkout).

    Membalas 403 kalau tidak ada sesi berjalan. Dipertahankan apa adanya
    untuk kompatibilitas; klien baru sebaiknya memakai
    `GET /sessions/active/status` di bawah."""
    return await _get_active_session(session)


# CATATAN URUTAN RUTE: endpoint ini WAJIB dideklarasikan sebelum
# `GET /sessions/{session_id}`, kalau tidak "active" akan dicoba diurai
# sebagai UUID oleh rute tersebut.
@app.get(f"{PREFIX}/sessions/active/status", response_model=ActiveSessionStatusRead, tags=["sessions"])
async def get_active_session_status(
    session: AsyncSession = Depends(get_async_session),
):
    """PUBLIC: Apakah ada sesi yang sedang berjalan sekarang?

    SELALU 200 — "galeri sedang tutup" adalah kondisi normal, bukan error,
    jadi tidak disampaikan lewat 403 seperti endpoint di atas. Inilah yang
    dipakai penjaga rute frontend (`RequireActiveSession`) untuk memutuskan
    apakah pengunjung boleh masuk ke halaman pembelian atau dialihkan ke
    halaman "belum bisa membeli tiket"."""
    active = await _find_active_session(session)
    return ActiveSessionStatusRead(
        has_active=active is not None,
        server_time=datetime.now(WIB),
        # Konversi eksplisit dari objek ORM ke skema respons.
        session=OperationalSessionRead.model_validate(active) if active else None,
    )


@app.get(f"{PREFIX}/sessions/{{session_id}}", response_model=OperationalSessionRead, tags=["sessions"])
async def get_operational_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker),
):
    """STAFF: Detail satu sesi operasional beserta tiket aktif & audit."""
    result = await session.execute(select(OperationalSession).where(OperationalSession.id == session_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan.")
    return entry


@app.patch(f"{PREFIX}/sessions/{{session_id}}/open", response_model=OperationalSessionRead, tags=["sessions"])
async def open_operational_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),  # UBAH: admin-only (sebelumnya current_kasir)
):
    """ADMIN: Membuka sesi.

    UBAH ALUR BISNIS: nomor tiket awal TIDAK LAGI wajib diisi sebelum
    sesi dibuka (validasi lama dihapus). Kasir sekarang WAJIB mengisi
    nomor tiket awal sendiri saat pertama kali membuka halaman Detail
    Sesi di frontend (`/sesi/:sessionId`) — itulah gerbang barunya, bukan
    proses buka-sesi ini. Hanya admin yang boleh memanggil endpoint ini
    (sebelumnya admin & kasir keduanya bisa)."""
    result = await session.execute(select(OperationalSession).where(OperationalSession.id == session_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan.")
    if entry.status != "draft":
        raise HTTPException(status_code=400, detail=f"Sesi berstatus '{entry.status}', tidak bisa dibuka.")

    entry.status = "opened"
    try:
        await session.commit()
        await session.refresh(entry)
        return entry
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal membuka sesi: {e}")


@app.patch(f"{PREFIX}/sessions/{{session_id}}/close", response_model=OperationalSessionRead, tags=["sessions"])
async def close_operational_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    admin: User = Depends(current_admin),  # UBAH: admin-only (sebelumnya current_kasir)
):
    """ADMIN: Menutup sesi. Wajib seluruh tiket aktif sudah diisi nomor
    tiket akhir (aturan ini TIDAK berubah). Hanya admin yang boleh
    memanggil endpoint ini (sebelumnya admin & kasir keduanya bisa)."""
    result = await session.execute(select(OperationalSession).where(OperationalSession.id == session_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan.")
    if entry.status != "opened":
        raise HTTPException(status_code=400, detail=f"Sesi berstatus '{entry.status}', tidak bisa ditutup.")

    missing = [st for st in entry.active_tickets if not st.audit or st.audit.end_ticket_number is None]
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Semua tiket aktif harus diisi nomor tiket akhir (end_ticket_number) sebelum sesi ditutup."
        )

    entry.status = "closed"
    try:
        await session.commit()
        await session.refresh(entry)
        return entry
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menutup sesi: {e}")


# ==========================================
# SESSION TICKET AUDIT (ADMIN & KASIR) — nomor tiket fisik awal & akhir
# ==========================================

@app.patch(
    f"{PREFIX}/session-tickets/{{session_ticket_id}}/audit/start",
    response_model=SessionTicketAuditRead,
    tags=["sessions"]
)
async def set_start_ticket_number(
    session_ticket_id: uuid.UUID,
    payload: SessionTicketAuditStartUpdate,
    session: AsyncSession = Depends(get_async_session),
    kasir: User = Depends(current_kasir),
):
    """ADMIN/KASIR: Mengisi/mengubah nomor tiket fisik awal untuk SATU
    tiket aktif dalam sesi. Boleh kapan saja selama sesi induknya
    berstatus 'draft' atau 'opened' (TIDAK terkunci lagi setelah 1x
    disimpan seperti sebelumnya).

    Untuk mengisi banyak tiket sekaligus dalam satu transaksi database,
    pakai `PATCH /sessions/{{session_id}}/audit/bulk` — endpoint ini
    dipertahankan untuk kompatibilitas & pemakaian satu-per-satu."""
    result = await session.execute(
        select(SessionTicket)
        .options(selectinload(SessionTicket.session))
        .where(SessionTicket.id == session_ticket_id)
    )
    st = result.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Tiket sesi tidak ditemukan.")

    if st.session.status not in ("draft", "opened"):
        raise HTTPException(
            status_code=400,
            detail="Nomor tiket awal hanya bisa diisi/diubah saat sesi berstatus draft atau opened."
        )

    audit = st.audit
    if not audit:
        audit = SessionTicketAudit(session_ticket_id=session_ticket_id)
        session.add(audit)

    audit.start_ticket_number = payload.start_ticket_number
    try:
        await session.commit()
        await session.refresh(audit)
        return audit
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan nomor tiket awal: {e}")


@app.patch(
    f"{PREFIX}/session-tickets/{{session_ticket_id}}/audit/end",
    response_model=SessionTicketAuditRead,
    tags=["sessions"]
)
async def set_end_ticket_number(
    session_ticket_id: uuid.UUID,
    payload: SessionTicketAuditEndUpdate,
    session: AsyncSession = Depends(get_async_session),
    kasir: User = Depends(current_kasir),
):
    """ADMIN/KASIR: Mengisi/mengubah nomor tiket fisik akhir untuk SATU
    tiket aktif dalam sesi. Boleh kapan saja selama sesi induknya
    berstatus 'opened'.

    Untuk mengisi banyak tiket sekaligus dalam satu transaksi database,
    pakai `PATCH /sessions/{{session_id}}/audit/bulk`."""
    result = await session.execute(
        select(SessionTicket)
        .options(selectinload(SessionTicket.session))
        .where(SessionTicket.id == session_ticket_id)
    )
    st = result.scalars().first()
    if not st:
        raise HTTPException(status_code=404, detail="Tiket sesi tidak ditemukan.")

    if st.session.status != "opened":
        raise HTTPException(
            status_code=400,
            detail="Nomor tiket akhir hanya bisa diisi/diubah saat sesi berstatus opened."
        )

    audit = st.audit
    if not audit or audit.start_ticket_number is None:
        raise HTTPException(status_code=400, detail="Nomor tiket awal harus diisi terlebih dahulu.")

    if payload.end_ticket_number < audit.start_ticket_number:
        raise HTTPException(status_code=400, detail="Nomor tiket akhir tidak boleh lebih kecil dari nomor awal.")

    audit.end_ticket_number = payload.end_ticket_number
    try:
        await session.commit()
        await session.refresh(audit)
        return audit
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan nomor tiket akhir: {e}")


@app.patch(
    f"{PREFIX}/sessions/{{session_id}}/audit/bulk",
    response_model=OperationalSessionRead,
    tags=["sessions"]
)
async def bulk_update_session_ticket_audit(
    session_id: uuid.UUID,
    payload: SessionTicketAuditBulkUpdate,
    session: AsyncSession = Depends(get_async_session),
    kasir: User = Depends(current_kasir),
):
    """ADMIN/KASIR — BARU: Menyimpan nomor tiket fisik (awal &/atau akhir)
    untuk BANYAK tiket aktif sekaligus, dalam SATU transaksi database:
    semua perubahan berhasil bersama-sama, atau tidak ada satu pun yang
    tersimpan (all-or-nothing). Dipakai oleh:
      - Gerbang "isi nomor awal" di halaman Detail Sesi (frontend) yang
        wajib dilewati kasir sebelum bisa melihat Antrian/Riwayat/Ringkasan.
      - Modal "Detail / Audit" pada daftar Sesi Operasional.

    Item yang tidak menyertakan `start_ticket_number` atau
    `end_ticket_number` (None) TIDAK mengubah nilai yang sudah tersimpan
    untuk field tsb — kirim hanya field yang benar-benar diubah pengguna.
    """
    result = await session.execute(select(OperationalSession).where(OperationalSession.id == session_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan.")

    if entry.status not in ("draft", "opened"):
        raise HTTPException(
            status_code=400,
            detail="Nomor tiket hanya bisa diisi/diubah saat sesi berstatus draft atau opened."
        )

    ticket_map = {st.id: st for st in entry.active_tickets}

    # --- PASS 1: validasi SEMUA item dulu, TANPA mengubah apa pun. Kalau
    # ada satu saja yang tidak valid, tidak ada perubahan yang tersimpan
    # sama sekali (all-or-nothing, sesuai spesifikasi). ---
    for item in payload.items:
        st = ticket_map.get(item.session_ticket_id)
        if not st:
            raise HTTPException(
                status_code=400,
                detail=f"Tiket sesi {item.session_ticket_id} bukan bagian dari sesi ini."
            )

        label = st.sub_category.name if st.sub_category else str(st.id)

        if item.end_ticket_number is not None:
            if entry.status != "opened":
                raise HTTPException(
                    status_code=400,
                    detail="Nomor tiket akhir hanya bisa diisi saat sesi berstatus opened."
                )
            effective_start = (
                item.start_ticket_number
                if item.start_ticket_number is not None
                else (st.audit.start_ticket_number if st.audit else None)
            )
            if effective_start is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nomor tiket awal untuk '{label}' harus diisi terlebih dahulu."
                )
            if item.end_ticket_number < effective_start:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nomor tiket akhir untuk '{label}' tidak boleh lebih kecil dari nomor awal."
                )

    # --- PASS 2: semua item valid, baru terapkan perubahan. ---
    for item in payload.items:
        st = ticket_map[item.session_ticket_id]
        audit = st.audit
        if not audit:
            audit = SessionTicketAudit(session_ticket_id=st.id)
            session.add(audit)
            st.audit = audit

        if item.start_ticket_number is not None:
            audit.start_ticket_number = item.start_ticket_number
        if item.end_ticket_number is not None:
            audit.end_ticket_number = item.end_ticket_number

    try:
        await session.commit()
        result = await session.execute(
            select(OperationalSession).where(OperationalSession.id == session_id)
        )
        return result.scalars().first()
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Gagal menyimpan nomor tiket: {e}")


# ==========================================
# TRANSACTION / QUEUE ROUTERS
# ==========================================

@app.post(f"{PREFIX}/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_async_session)
):
    """PUBLIC: Pengunjung membuat antrian transaksi baru pada sesi operasional yang sedang berjalan."""
    for attempt in range(settings.max_queue_retry):
        try:
            active_session = await _get_active_session(session)

            # Ambil daftar tiket yang benar-benar aktif pada sesi ini
            st_result = await session.execute(
                select(SessionTicket).where(SessionTicket.session_id == active_session.id)
            )
            active_sub_category_ids = {
                st.ticket_sub_category_id for st in st_result.scalars().all()
            }

            total_price = 0
            transaction_items = []

            for item in payload.items:
                if item.ticket_sub_category_id not in active_sub_category_ids:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Tiket {item.ticket_sub_category_id} tidak tersedia pada sesi ini."
                    )

                sub_result = await session.execute(
                    select(TicketSubCategory).where(TicketSubCategory.id == item.ticket_sub_category_id)
                )
                sub_category = sub_result.scalars().first()
                if not sub_category:
                    raise HTTPException(status_code=400, detail="Sub-kategori tiket tidak ditemukan.")
                # BARU: jaga-jaga kalau sub-kategori dinonaktifkan admin
                # SETELAH sesi ini dibuat tapi sebelum transaksi ini masuk.
                if not sub_category.is_active:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Tiket '{sub_category.name}' sudah tidak tersedia lagi."
                    )

                item_total = sub_category.price * item.quantity
                total_price += item_total

                # Snapshot nama dibekukan di sini supaya struk & riwayat
                # lama tidak ikut berubah kalau admin mengganti nama tiket
                # besok. Dua bentuk disimpan berdampingan:
                #   - `ticket_name_snapshot`      : cermin Bahasa Indonesia,
                #     dipakai apa adanya oleh seluruh laporan & ekspor staf.
                #   - `ticket_name_snapshot_i18n` : per bahasa, dipakai layar
                #     antrean/struk pengunjung agar bahasanya konsisten
                #     dengan katalog yang barusan mereka lihat.
                master = sub_category.ticket_master
                snapshot_name = (
                    f"{master.name} - {sub_category.name}" if master else sub_category.name
                )
                snapshot_i18n = build_snapshot_i18n(
                    master.name_i18n if master else None,
                    sub_category.name_i18n,
                )

                transaction_items.append(TransactionItem(
                    ticket_sub_category_id=sub_category.id,
                    ticket_name_snapshot=snapshot_name,
                    ticket_name_snapshot_i18n=snapshot_i18n,
                    quantity=item.quantity,
                    unit_price=sub_category.price
                ))

            now_wib = datetime.now(WIB)
            start_of_today_wib    = datetime(now_wib.year, now_wib.month, now_wib.day, tzinfo=WIB)
            start_of_tomorrow_wib = start_of_today_wib + timedelta(days=1)

            result = await session.execute(
                select(func.max(TransactionEntry.queue_number))
                .where(
                    TransactionEntry.created_at >= start_of_today_wib,
                    TransactionEntry.created_at < start_of_tomorrow_wib
                )
            )

            # --- LOGIKA TIKETING ---
            max_queue = result.scalar() or 0
            sequence_number = max_queue + 1

            # Format %m%d menghasilkan MMDD (contoh: 0809)
            date_prefix = now_wib.strftime("%m%d")

            # Gabungkan dengan nomor urut (zfill(3) untuk format 001, 002, dst)
            formatted_ticket_code = f"{date_prefix}-{str(sequence_number).zfill(3)}"

            new_transaction = TransactionEntry(
                session_id=active_session.id,
                queue_number=sequence_number,          # Angka asli tetap disimpan untuk pencarian max() besok
                ticket_code=formatted_ticket_code,      # Simpan string format baru
                customer_name=payload.customer_name,
                date_only=now_wib.date(),
                total_price=total_price,
                status="pending",
                payment_method=payload.payment_method.value,
                items=transaction_items,
                origins=[TransactionOriginEntry(**o.dict()) for o in payload.origins]
            )

            session.add(new_transaction)
            await session.commit()
            await session.refresh(new_transaction)
            return new_transaction

        except HTTPException:
            await session.rollback()
            raise
        except IntegrityError:
            await session.rollback()
            continue

    raise HTTPException(status_code=409, detail="Queue conflict, please retry")


@app.get(f"{PREFIX}/transactions", response_model=List[TransactionResponse], tags=["transactions"])
async def list_today_transactions(
    status: Optional[str] = Query(None, description="Filter by payment status (e.g., 'pending')"),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker) # <-- PENJAGA PINTU: ADMIN, KASIR, CHECKER
):
    """STAFF: Lists transactions FOR TODAY ONLY."""
    try:
        now_wib = datetime.now(WIB)
        start_of_today_wib    = datetime(now_wib.year, now_wib.month, now_wib.day, tzinfo=WIB)
        start_of_tomorrow_wib = start_of_today_wib + timedelta(days=1)

        query = select(TransactionEntry).order_by(TransactionEntry.created_at.asc())
        query = query.where(
            TransactionEntry.created_at >= start_of_today_wib,
            TransactionEntry.created_at < start_of_tomorrow_wib
        )
        if status:
            query = query.where(TransactionEntry.status == status)

        result = await session.execute(query)
        entries = result.scalars().unique().all()
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch today's transactions: {e}")


@app.get(f"{PREFIX}/transactions/all", response_model=List[TransactionResponse], tags=["transactions"])
async def list_all_transactions(
    status: Optional[str] = Query(None, description="Filter by payment status (e.g., 'pending')"),
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_checker) # <-- PENJAGA PINTU: ADMIN, KASIR, CHECKER
):
    """STAFF: Lists ALL historical transactions."""
    try:
        query = select(TransactionEntry).order_by(TransactionEntry.created_at.asc())
        if status:
            query = query.where(TransactionEntry.status == status)

        result = await session.execute(query)
        entries = result.scalars().unique().all()
        return entries
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch all transactions: {e}")


@app.get(f"{PREFIX}/transactions/{{transaction_id}}", response_model=TransactionResponse, tags=["transactions"])
async def get_transaction_details(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session)
):
    """PUBLIC: Fetches a specific transaction ticket using its UUID."""
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()
        if not entry:
            raise HTTPException(status_code=404, detail="Ticket not found")
        return entry
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error {e}")


@app.patch(f"{PREFIX}/transactions/{{transaction_id}}/status", response_model=TransactionResponse, tags=["transactions"])
async def update_transaction_status(
    transaction_id: uuid.UUID,
    payload: TransactionStatusUpdate,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_kasir) # <-- PENJAGA PINTU: HANYA ADMIN & KASIR (Checker Ditolak)
):
    """STAFF: Updates the payment status of a ticket."""
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()
        if not entry:
            raise HTTPException(status_code=404, detail="Ticket not found")

        entry.status = payload.status.value
        if payload.status.value in ["confirmed", "paid"]:
            entry.confirmed_at = datetime.now(WIB)

        await session.commit()
        await session.refresh(entry)
        return entry
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update status {e}")


@app.patch(f"{PREFIX}/transactions/{{transaction_id}}/edit", response_model=TransactionResponse, tags=["transactions"])
async def edit_transaction_data(
    transaction_id: uuid.UUID,
    payload: TransactionUpdateData,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_kasir) # <-- PENJAGA PINTU: HANYA ADMIN & KASIR (Checker Ditolak)
):
    """STAFF: Updates customer name, items, origins, status, or payment method."""
    result = await session.execute(select(TransactionEntry).where(TransactionEntry.id == transaction_id))
    entry = result.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if payload.customer_name is not None:
        entry.customer_name = payload.customer_name

    if payload.items is not None:
        await session.execute(delete(TransactionItem).where(TransactionItem.transaction_id == transaction_id))

        total_price = 0
        new_items = []
        for item in payload.items:
            sub_result = await session.execute(
                select(TicketSubCategory).where(TicketSubCategory.id == item.ticket_sub_category_id)
            )
            sub_category = sub_result.scalars().first()
            if not sub_category:
                raise HTTPException(status_code=400, detail="Sub-kategori tiket tidak ditemukan.")

            total_price += sub_category.price * item.quantity

            # Item yang diganti kasir juga di-snapshot ulang dalam kedua
            # bentuk — kalau hanya cermin Bahasa Indonesia yang diperbarui,
            # struk pengunjung untuk transaksi yang pernah diedit akan
            # kehilangan versi bahasanya (i18n kosong).
            master = sub_category.ticket_master
            snapshot_name = (
                f"{master.name} - {sub_category.name}" if master else sub_category.name
            )
            snapshot_i18n = build_snapshot_i18n(
                master.name_i18n if master else None,
                sub_category.name_i18n,
            )

            new_items.append(TransactionItem(
                transaction_id=transaction_id,
                ticket_sub_category_id=sub_category.id,
                ticket_name_snapshot=snapshot_name,
                ticket_name_snapshot_i18n=snapshot_i18n,
                quantity=item.quantity,
                unit_price=sub_category.price
            ))

        session.add_all(new_items)
        entry.total_price = total_price

    if getattr(payload, "origins", None) is not None:
        await session.execute(delete(TransactionOriginEntry).where(TransactionOriginEntry.transaction_id == transaction_id))

        new_origins = [
            TransactionOriginEntry(
                transaction_id=transaction_id,
                country_code=origin.country_code,
                count=origin.count
            )
            for origin in payload.origins
        ]
        session.add_all(new_origins)

    if payload.status is not None:
        entry.status = payload.status.value
        if payload.status.value in ["confirmed", "paid"]:
            entry.confirmed_at = datetime.now(WIB)

    if payload.payment_method is not None:
        entry.payment_method = payload.payment_method.value

    try:
        await session.commit()
        await session.refresh(entry)
        return entry
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to edit transaction: {e}")


@app.delete(f"{PREFIX}/transactions/{{transaction_id}}", tags=["transactions"])
async def delete_transaction_entry(
    transaction_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_admin) # <-- PENJAGA PINTU: HANYA ADMIN BISA MENGHAPUS
):
    """ADMIN: Deletes a specific transaction from the queue."""
    try:
        result = await session.execute(
            select(TransactionEntry).where(TransactionEntry.id == transaction_id)
        )
        entry = result.scalars().first()
        if not entry:
            raise HTTPException(status_code=404, detail="Queue entry not found")

        await session.delete(entry)
        await session.commit()
        return {"success": True, "message": "Queue entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete entry {e}")
