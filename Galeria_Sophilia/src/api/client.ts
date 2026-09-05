/**
 * src/api/client.ts
 * ----------------------------------------------------
 * Klien fetch terpusat untuk seluruh aplikasi.
 * - Menyisipkan otomatis header Authorization: Bearer <token>.
 * - Menangani error 401 secara global (bersihkan token & redirect /login).
 * - Menyediakan helper apiGet / apiPost / apiPatch / apiDelete yang
 *   sudah di-generic-kan agar tipe respons konsisten di seluruh komponen.
 */

export const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  const tokenType = localStorage.getItem("token_type") ?? "Bearer";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `${tokenType} ${token}` } : {}),
  };
}

/** Membersihkan sesi lokal & mengarahkan pengguna kembali ke halaman login. */
export function forceLogout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

async function parseErrorDetail(response: Response): Promise<unknown> {
  try {
    const data = await response.json();
    return data?.detail ?? data;
  } catch {
    return response.statusText;
  }
}

function detailToMessage(detail: unknown, fallback: string): string {
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return fallback;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Set true untuk endpoint publik yang tidak butuh token (mis. login, cek sesi aktif). */
  skipAuthRedirect?: boolean;
}

/**
 * Pemanggil inti. Selalu menyertakan prefix `/api/v1`, menyisipkan header
 * auth, dan melempar `ApiError` yang konsisten ketika response gagal.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuthRedirect = false } = options;

  const url = path.startsWith("http") ? path : `${API_PREFIX}${path}`;

  const response = await fetch(url, {
    method,
    headers: getAuthHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    const detail = await parseErrorDetail(response);
    if (!skipAuthRedirect) {
      forceLogout();
    }
    throw new ApiError(detailToMessage(detail, "Sesi Anda telah berakhir. Silakan login kembali."), 401, detail);
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new ApiError(detailToMessage(detail, `Permintaan gagal (${response.status})`), response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // Beberapa endpoint DELETE mengembalikan body kecil { success, message }
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const apiGet = <T,>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
  apiRequest<T>(path, { ...opts, method: "GET" });

export const apiPost = <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
  apiRequest<T>(path, { ...opts, method: "POST", body });

export const apiPatch = <T,>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
  apiRequest<T>(path, { ...opts, method: "PATCH", body });

export const apiDelete = <T,>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
  apiRequest<T>(path, { ...opts, method: "DELETE" });
