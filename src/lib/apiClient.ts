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

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(options.headers);
  // FormData bodies (image uploads) must NOT get an explicit Content-Type - fetch sets its own
  // multipart boundary automatically, and overriding it here would break parsing server-side.
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && !isRetry && unauthorizedHandler) {
    const refreshed = await unauthorizedHandler();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("json") ? await response.json() : undefined;

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
