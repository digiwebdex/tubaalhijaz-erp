// ─── TUBA AL HIJAZ · Shared API client ───────────────────────────────────────
// fetch-based client for the NestJS backend with automatic token refresh.
//  - Access token lives in memory + sessionStorage (survives reload, not tabs)
//  - Refresh token is an httpOnly cookie (path /auth) — sent automatically
//    with credentials: "include"; a 401 triggers ONE refresh + retry.

// Port 3210: 3000/3010 collide with other dev servers / IDE port-forwards on this machine
const API_URL: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://127.0.0.1:3210";

const TOKEN_KEY = "tuba_at";
const USER_KEY = "tuba_user";

/** Browser sessionStorage, or null in Node (self-tests / non-DOM). */
const store: Storage | null = typeof sessionStorage !== "undefined" ? sessionStorage : null;

let accessToken: string | null = store?.getItem(TOKEN_KEY) ?? null;
let refreshPromise: Promise<boolean> | null = null;

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  nameBn: string | null;
  role: string;
  roleName: string;
  permissions: string[];
  companyId: string | null;
  company: {
    id: string;
    code: string;
    type: "AGENT" | "SUPPLIER";
    name: string;
    nameBn: string | null;
    verificationStatus: "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "SUSPENDED";
    rejectionReason: string | null;
    joinedAt: string;
    supplierType: string | null;
    platformRating: string | null;
  } | null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function setSession(token: string | null, user?: ApiUser | null) {
  accessToken = token;
  if (token) store?.setItem(TOKEN_KEY, token);
  else store?.removeItem(TOKEN_KEY);
  if (user !== undefined) {
    if (user) store?.setItem(USER_KEY, JSON.stringify(user));
    else store?.removeItem(USER_KEY);
  }
}

export function getStoredUser(): ApiUser | null {
  try {
    const raw = store?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return !!accessToken;
}

/** Current access JWT (memory) — used by Socket.io handshakes (ops live board). */
export function getAccessToken(): string | null {
  return accessToken;
}

async function tryRefresh(): Promise<boolean> {
  // single-flight: concurrent 401s share one refresh call
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; user: ApiUser };
      setSession(data.accessToken, data.user);
      return true;
    } catch {
      return false;
    } finally {
      // allow the next refresh attempt after this one settles
      setTimeout(() => (refreshPromise = null), 0);
    }
  })();
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retryOn401 && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, options, false);
    setSession(null, null);
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] } | null)?.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(", ") : msg, body);
  }
  return body as T;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface RegisterAgentPayload {
  companyName: string;
  crNumber?: string;
  ownerName: string;
  ownerIdNumber?: string;
  ownerNationality?: string;
  businessEmail: string;
  website?: string;
  phone?: string;
  city?: string;
  bankName?: string;
  accountNumber?: string;
  iban?: string;
  guarantor1?: { name: string; nationalId: string; phone?: string };
  guarantor2?: { name: string; nationalId: string; phone?: string };
  referenceAgencyName?: string;
  referenceAgentCode?: string;
  password?: string;
  tradeLicenseFileId?: string;
  ownerIdFileId?: string;
  officePhotoFileIds?: string[];
  logoFileId?: string;
  chequeFileId?: string;
  depositFileId?: string;
}

export interface RegisterSupplierPayload {
  type: "HOTEL" | "TRANSPORT" | "CATERING";
  companyName: string;
  crNumber?: string;
  contactPerson: string;
  businessEmail: string;
  phone?: string;
  city?: string;
  starRating?: number;
  district?: string;
  fleetSize?: number;
  primaryVehicleType?: string;
  dailyMealCapacity?: number;
  halalCertBody?: string;
  password?: string;
  tradeLicenseFileId?: string;
  certificationFileId?: string;
}

export interface RegistrationResult {
  companyId: string;
  applicationCode: string;
  verificationStatus: string;
  loginEmail: string;
  tempPassword?: string;
}

export type UploadKind =
  | "TRADE_LICENSE"
  | "OWNER_ID"
  | "OFFICE_PHOTO"
  | "COMPANY_LOGO"
  | "SIGNED_CHEQUE"
  | "DEPOSIT_PROOF"
  | "SUPPLIER_CERT"
  | "OTHER";

export interface UploadResult {
  documentId: string;
  storageKey: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: UploadKind;
  url: string | null;
}

export const api = {
  baseUrl: API_URL,

  async login(email: string, password: string, portal?: "agent" | "supplier" | "admin") {
    const data = await request<{ accessToken: string; user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, ...(portal ? { portal } : {}) }),
    });
    setSession(data.accessToken, data.user);
    return data.user;
  },

  async logout() {
    await request("/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession(null, null);
  },

  me() {
    return request<ApiUser>("/auth/me");
  },

  /** Multipart upload (registration documents, vouchers…). */
  async uploadFile(file: File, kind: UploadKind = "OTHER"): Promise<UploadResult> {
    const fd = new FormData();
    fd.append("file", file);
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(`${API_URL}/uploads?kind=${kind}`, {
      method: "POST",
      body: fd, // browser sets the multipart boundary — no manual Content-Type
      headers,
      credentials: "include",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body as { message?: string } | null)?.message ?? `Upload failed (${res.status})`;
      throw new ApiError(res.status, Array.isArray(msg) ? msg.join(", ") : msg, body);
    }
    return body as UploadResult;
  },

  /** Multipart upload to an arbitrary endpoint with extra form fields (supplier voucher/invoice uploads). */
  async uploadWithFields<T>(path: string, file: File, fields: Record<string, string | undefined>): Promise<T> {
    const fd = new FormData();
    fd.append("file", file);
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== "") fd.append(k, v);
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(`${API_URL}${path}`, { method: "POST", body: fd, headers, credentials: "include" });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (body as { message?: string } | null)?.message ?? `Upload failed (${res.status})`;
      throw new ApiError(res.status, Array.isArray(msg) ? msg.join(", ") : msg, body);
    }
    return body as T;
  },

  /** Fetch a stored file as a blob URL (auth-carrying download for window.open / <a>). */
  async fileBlobUrl(fileId: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(`${API_URL}/uploads/${fileId}/file`, { headers, credentials: "include" });
    if (!res.ok) throw new ApiError(res.status, `Could not fetch file (${res.status})`);
    return URL.createObjectURL(await res.blob());
  },

  registerAgent(payload: RegisterAgentPayload) {
    return request<RegistrationResult>("/auth/register/agent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  registerSupplier(payload: RegisterSupplierPayload) {
    return request<RegistrationResult>("/auth/register/supplier", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // generic helpers for later phases
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
