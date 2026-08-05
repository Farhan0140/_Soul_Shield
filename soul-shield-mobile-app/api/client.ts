import { ApiError } from '@/lib/errors';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

interface RequestOptions extends RequestInit {
  token?: string | null;
  /** Aborts the request after this many ms, surfacing as the same
   * status-0 network error as any other unreachable-server case. Opt-in
   * (undefined = no timeout) since interactive screens already have their own
   * retry/loading affordances — background callers without a mounted UI to
   * fall back on (see lib/background-sync/sync.ts) are the ones that need a
   * hard ceiling so a stalled connection can't wedge a task indefinitely. */
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, timeoutMs, ...rest } = options;

  const controller = timeoutMs ? new AbortController() : undefined;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal: controller?.signal ?? rest.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `JWT ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('Network error', 0, 'NETWORK_ERROR');
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!response.ok) {
    const raw = await response.text();
    // Most endpoints send JSON ({ "error": "..." } from util.SendError, occasionally
    // { "message": "..." }), but /send-otp and /verify-otp use Go's http.Error and send
    // plain text instead — fall back to the raw text when JSON parsing fails.
    let body: Record<string, unknown> | undefined;
    try {
      body = JSON.parse(raw);
    } catch {
      body = undefined;
    }
    const message =
      (body?.error as string | undefined) ??
      (body?.message as string | undefined) ??
      (body?.detail as string | undefined) ??
      raw.trim() ??
      `Request failed (${response.status})`;
    throw new ApiError(message || `Request failed (${response.status})`, response.status, body ?? raw);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const apiGet = <T,>(path: string, token?: string | null, timeoutMs?: number) =>
  request<T>(path, { method: 'GET', token, timeoutMs });

export const apiPost = <T,>(path: string, body: unknown, token?: string | null) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), token });

export const apiPatch = <T,>(path: string, body: unknown, token?: string | null) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}), token });

export const apiDelete = <T,>(path: string, token?: string | null) =>
  request<T>(path, { method: 'DELETE', token });
