/**
 * CortexOS Unified Secure API Client
 * - Provides seamless connectivity in both Vite development and packaged Tauri .exe environments.
 * - Automatically injects in-memory Daemon Secret Token (X-Cortex-Daemon-Token).
 * - Automatically injects Supabase JWT Bearer Authorization header for cryptographically verified requests.
 */

// In development or production .exe, the backend daemon listens on 127.0.0.1:8000
export const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Internal daemon security token (must match backend CORTEX_DAEMON_TOKEN)
let daemonSecret = import.meta.env.VITE_CORTEX_DAEMON_TOKEN || 'cortex-local-daemon-token-9a7f3e';

export function setDaemonToken(token: string) {
  if (token && typeof token === 'string') {
    daemonSecret = token.trim();
  }
}

export function getDaemonToken(): string {
  return daemonSecret;
}

/**
 * Retrieves the current Supabase session access token from browser / webview storage.
 */
export function getSupabaseAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    // Search localStorage for Supabase auth token
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.access_token || parsed?.session?.access_token || null;
        }
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Normalizes an API path and prepends the full 127.0.0.1:8000 base URL.
 */
export function buildApiUrl(path: string): string {
  const cleanPath = path.startsWith('/api') ? path.slice(4) : path;
  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${API_BASE_URL}${normalized}`;
}

/**
 * Standard fetch wrapper with automatic security headers and error handling.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = buildApiUrl(path);
  const headers = new Headers(init?.headers);

  // 1. Inject Daemon Secret Token
  headers.set('X-Cortex-Daemon-Token', daemonSecret);

  // 2. Inject Supabase JWT Session Token if present and not explicitly provided
  if (!headers.has('Authorization')) {
    const token = getSupabaseAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  // 3. Ensure JSON Content-Type when sending body without specified type
  if (init?.body && !headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

/**
 * Convenience helper for GET requests parsing JSON.
 */
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: 'GET' });
  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error) errMessage = errData.error;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Convenience helper for POST requests sending and parsing JSON.
 */
export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await apiFetch(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error) errMessage = errData.error;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Convenience helper for PUT requests sending and parsing JSON.
 */
export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const res = await apiFetch(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error) errMessage = errData.error;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

/**
 * Convenience helper for DELETE requests.
 */
export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    method: 'DELETE',
  });
  if (!res.ok) {
    let errMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errData = await res.json();
      if (errData?.error) errMessage = errData.error;
    } catch {}
    throw new Error(errMessage);
  }
  return res.json();
}

