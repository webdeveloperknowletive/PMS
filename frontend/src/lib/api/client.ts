import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_URL } from "@/lib/constants";

const ACCESS_TOKEN_KEY = "pms_access_token";
const REFRESH_TOKEN_KEY = "pms_refresh_token";

export const tokenStorage = {
  getAccessToken: () => (typeof window === "undefined" ? null : localStorage.getItem(ACCESS_TOKEN_KEY)),
  getRefreshToken: () => (typeof window === "undefined" ? null : localStorage.getItem(REFRESH_TOKEN_KEY)),
  setTokens: (access: string, refresh?: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    // Lightweight, non-httpOnly marker cookie so middleware.ts (which runs on
    // the edge and can't see localStorage) can gate protected routes. It
    // carries no token value on purpose — just a presence flag.
    document.cookie = "pms_has_session=1; path=/; max-age=2592000; SameSite=Lax";
  },
  clear: () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    document.cookie = "pms_has_session=; path=/; max-age=0";
  },
};

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach the bearer token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401, try /auth/refresh-token once, replay the original request, and
// only redirect to /login if the refresh itself fails.
let isRefreshing = false;
let pendingQueue: { resolve: (token: string) => void; reject: (err: unknown) => void }[] = [];

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh when the failing call *is* the auth endpoints.
    const publicAuthEndpoints = ["/auth/login", "/auth/platform-login", "/auth/refresh-token", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email", "/auth/resend-verification", "/organizations/register", "/organizations/invitations/accept"];
    if (publicAuthEndpoints.some((endpoint) => originalRequest.url?.includes(endpoint))) {
      return Promise.reject(error);
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      tokenStorage.clear();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${API_URL}/auth/refresh-token`,
        { refresh_token: refreshToken },
        { timeout: 10_000 },
      );
      tokenStorage.setTokens(data.access_token);
      flushQueue(null, data.access_token);
      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      tokenStorage.clear();
      if (typeof window !== "undefined") window.location.href = "/login";
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

/** Pulls FastAPI's { detail: "..." } (or 422 validation array) into a readable string. */
export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;

    // New custom error shape from register_exception_handlers:
    // { success: false, error_code: "...", message: "...", details: ... }
    if (typeof data?.message === "string") return data.message;

    // FastAPI's default shape for anything not caught by the custom
    // handlers (e.g. a raw 422 from Pydantic validation before it hits
    // your routes): { detail: "..." } or { detail: [{ msg: "..." }, ...] }
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");

    return error.message;
  }
  return "Something went wrong. Please try again.";
}
