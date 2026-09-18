import { ApiError } from '@/lib/errors';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export interface RetryOptions {
  /** Max attempts including the first - e.g. 5 means up to 4 retries after
   * the initial failed one. */
  attempts: number;
  /** Delay before the first retry; doubles after each subsequent failure,
   * capped at maxDelayMs - long enough to ride out a Render free-tier
   * instance spinning back up from sleep (commonly 30-50s) without hammering
   * it every second. */
  delayMs: number;
  maxDelayMs?: number;
}

interface RequestOptions extends RequestInit {
  token?: string | null;
  /** Aborts the request after this many ms, surfacing as the same
   * status-0 network error as any other unreachable-server case. Opt-in
   * (undefined = no timeout) since interactive screens already have their own
   * retry/loading affordances — background callers without a mounted UI to
   * fall back on (see lib/background-sync/sync.ts) are the ones that need a
   * hard ceiling so a stalled connection can't wedge a task indefinitely. */
  timeoutMs?: number;
  /** Retries on a timeout/network error or a 502/503/504 (what Render's
   * free tier typically returns - or simply never responds until it does -
   * while a sleeping instance wakes back up) instead of failing on the
   * first attempt. Opt-in, for background callers only (see
   * lib/background-sync/*): an interactive screen retrying silently for up
   * to a couple of minutes would just look hung, not "still trying". Does
   * NOT retry a genuine 4xx (bad request, auth, validation) - those aren't
   * transient. */
  retry?: RetryOptions;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  // 0 = the request() catch block below, covering both a genuine network
  // error and our own AbortController timing out - Render's cold-start
  // symptom is usually the latter (it accepts the connection and holds the
  // request open while the container spins up, rather than refusing it
  // outright), so a timeout has to be treated the same as "try again" here.
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOnce<T>(path: string, options: Omit<RequestOptions, 'retry'>): Promise<T> {
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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retry, ...rest } = options;
  if (!retry) return requestOnce<T>(path, rest);

  let delay = retry.delayMs;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await requestOnce<T>(path, rest);
    } catch (error) {
      if (attempt >= retry.attempts || !isRetryableError(error)) throw error;
      await sleep(delay);
      delay = Math.min(delay * 2, retry.maxDelayMs ?? delay);
    }
  }
}

export const apiGet = <T,>(path: string, token?: string | null, timeoutMs?: number, retry?: RetryOptions) =>
  request<T>(path, { method: 'GET', token, timeoutMs, retry });

export const apiPost = <T,>(path: string, body: unknown, token?: string | null, retry?: RetryOptions) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), token, retry });

export const apiPatch = <T,>(path: string, body: unknown, token?: string | null) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}), token });

export const apiDelete = <T,>(path: string, token?: string | null) =>
  request<T>(path, { method: 'DELETE', token });
