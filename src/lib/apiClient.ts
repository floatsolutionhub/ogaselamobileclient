import { env } from "@/config/env";
import type { ProblemDetails } from "@/types/api";

const BASE_URL = env.apiUrl;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;

/** Called by AuthContext on login/logout/refresh - kept out of React state so every apiClient call always sees the latest token without needing to thread it through every call site. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Set by AuthContext once, so a 401 mid-call can trigger one silent refresh-and-retry without apiClient depending on AuthContext directly (would be a circular import). */
let unauthorizedHandler: (() => Promise<boolean>) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<boolean>) | null): void {
  unauthorizedHandler = handler;
}

/**
 * Several calls usually 401 together (a screen loading three things at once with an expired
 * token). They all wait on this one refresh instead of each sending the same refresh token - the
 * API rotates it, so every refresh after the first would fail and sign the user out.
 */
let pendingRefresh: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!unauthorizedHandler) return Promise.resolve(false);
  pendingRefresh ??= unauthorizedHandler()
    .catch(() => false)
    .finally(() => {
      pendingRefresh = null;
    });
  return pendingRefresh;
}

/** A call that never answers (bad signal, server stuck) fails after this instead of leaving its spinner up forever. */
const TIMEOUT_MS = 30_000;
/** Uploads send several MB over mobile data. */
const UPLOAD_TIMEOUT_MS = 120_000;

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  // FormData bodies (image uploads) must NOT get an explicit Content-Type - fetch sets its own
  // multipart boundary automatically, and overriding it here would break parsing server-side.
  if (options.body && !isForm) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), isForm ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? "This is taking too long. Check your connection and try again."
        : "Couldn't reach Ogasela. Check your internet connection and try again.",
      "Network",
    );
  } finally {
    clearTimeout(timer);
  }

  // Never for /auth/* itself: a 401 there is a wrong password or a dead refresh token, and
  // refreshing in response to the refresh call would wait on itself forever.
  if (response.status === 401 && !isRetry && !path.startsWith("/auth/")) {
    if (await refreshOnce()) {
      return request<T>(path, options, true);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  // A proxy/gateway error page can claim JSON and not be - treat it as no body rather than crash.
  const body = contentType.includes("json") ? await response.json().catch(() => undefined) : undefined;

  if (!response.ok) {
    const problem = body as ProblemDetails | undefined;
    // ASP.NET's validation ProblemDetails puts the actually-useful message in `errors` (field ->
    // messages), not `detail`/`title` - those are just "One or more validation errors occurred."
    // Falling back to title alone (as before) threw away the one part of the response that tells
    // the user what was actually wrong.
    const fieldErrors = problem?.errors ? Object.values(problem.errors).flat() : [];
    const message =
      fieldErrors.length > 0
        ? fieldErrors.join(" ")
        : (problem?.detail ?? problem?.title ?? response.statusText ?? "Request failed");
    throw new ApiError(response.status, message, problem?.title);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** For multipart/form-data uploads (listing photos, verification selfies, etc). */
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};
