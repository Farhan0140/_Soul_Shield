// Central API client with friendly, human-readable error messages
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'soulshield_token';

// Fired (on window) when an authenticated request comes back 401: the token
// expired or was revoked (password changed elsewhere, account deleted).
// AuthContext listens and signs the user out.
export const SESSION_EXPIRED_EVENT = 'soulshield:session-expired';

// Map backend error codes/messages to warm, understandable text
const ERROR_MAP = {
  400: "Hmm, that doesn't look quite right — please double-check what you entered.",
  401: "We don't recognize those credentials. Mind trying again?",
  403: "You don't have permission to do that right now.",
  404: "We looked everywhere, but couldn't find what you're asking for.",
  409: "That already exists — maybe try something different?",
  413: "That's too much data to send at once.",
  429: "Too many attempts. Please wait a while before trying again.",
  500: "Something went wrong on our end. We're on it — please try again in a moment.",
  503: "The server is busy right now. Please try again in a moment.",
  network: "Couldn't reach our servers. Check your internet and try again.",
  timeout: "That took too long. Please try again.",
};

// Specific messages for known backend scenarios
const SCENARIO_MAP = {
  'email already': "This email is already registered. Try logging in instead?",
  'invalid credentials': "Those credentials don't match our records.",
  'email not verified': "Please verify your email first — we sent you a code.",
  'otp expired': "That code expired. Request a fresh one?",
  'otp invalid': "That code doesn't match. Please try again.",
  'security answer you entered is incorrect': "The security answer you entered is incorrect. Please try again.",
  'security answer must be between': "Your security answer needs to be between 3 and 100 characters.",
  'too many failed attempts': "Too many failed attempts. Please try again later.",
  'reset session': "That reset session expired. Please verify your security answer again.",
  'already been used': "That reset link has already been used. Please verify your security answer again.",
  'task not scheduled': "This task isn't scheduled for that day.",
  'future date': "You can't record progress for a day that hasn't happened yet.",
  'unauthorized': "Please log in to continue.",
};

function humanizeError(status, data) {
  const msg = (data?.message || data?.error || '').toString().toLowerCase();

  // Check scenario-specific messages first
  for (const [key, value] of Object.entries(SCENARIO_MAP)) {
    if (msg.includes(key)) return value;
  }
  // Fall back to status-based
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  return ERROR_MAP[status] || ERROR_MAP[500];
}

// ---- Token storage ----------------------------------------------------------

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage blocked */ }
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

// The user's IANA zone, so the server's "today" is the user's today (not UTC).
function timeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; }
}

// ---- Server wake-up status (U4) ---------------------------------------------
// The API runs on a host that sleeps when idle; the first request after a
// nap can take 30-60 s. While we're retrying through that, the UI shows a
// "Waking up the server…" banner instead of an error.

let serverWaking = false;
const statusListeners = new Set();

// Session memory of "the server answered recently". Once it has woken up we
// don't ping /healthz again on every page load in the same tab session; the
// host only naps after ~15 min idle, so a recent answer means it's still up.
const AWAKE_KEY = 'soulshield_server_awake_at';
const AWAKE_TTL_MS = 10 * 60 * 1000;
let lastAwakeAt = (() => {
  try { return Number(sessionStorage.getItem(AWAKE_KEY)) || 0; } catch { return 0; }
})();

function markServerAwake() {
  lastAwakeAt = Date.now();
  try { sessionStorage.setItem(AWAKE_KEY, String(lastAwakeAt)); } catch { /* storage blocked */ }
}

/** True when the server answered within the last few minutes of this session. */
export function isServerKnownAwake() {
  return Date.now() - lastAwakeAt < AWAKE_TTL_MS;
}

function setServerWaking(value) {
  if (serverWaking === value) return;
  serverWaking = value;
  statusListeners.forEach((fn) => fn());
}
export function subscribeServerStatus(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
export function isServerWaking() {
  return serverWaking;
}

const ATTEMPT_TIMEOUT_MS = 15000;
const WAKE_BUDGET_MS = 90000; // stop retrying after this long in total
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Statuses a sleeping/booting host answers with before the app is up.
const WAKING_STATUSES = new Set([502, 503, 504]);

async function fetchOnce(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Only idempotent requests (GET, or ones flagged `retry`) are retried: a POST
// that timed out may still have been applied.
async function fetchWithWake(url, init, retry) {
  const started = Date.now();
  let delay = 2000;
  for (;;) {
    try {
      const res = await fetchOnce(url, init);
      if (retry && WAKING_STATUSES.has(res.status) && Date.now() - started < WAKE_BUDGET_MS) {
        setServerWaking(true);
      } else {
        if (!WAKING_STATUSES.has(res.status)) markServerAwake();
        setServerWaking(false);
        return res;
      }
    } catch (err) {
      const transient = err.name === 'AbortError' || err instanceof TypeError;
      if (!retry || !transient || Date.now() - started >= WAKE_BUDGET_MS) {
        setServerWaking(false);
        throw err;
      }
      setServerWaking(true);
    }
    await sleep(delay);
    delay = Math.min(delay * 1.5, 8000);
  }
}

/** Pings /healthz so a sleeping server starts booting while the user is still
 * on the login screen. Never throws. Skipped when the server already answered
 * recently in this session, and concurrent calls share one in-flight ping. */
let warmUpInFlight = null;
export function warmUpServer() {
  if (isServerKnownAwake()) return Promise.resolve();
  if (!warmUpInFlight) {
    warmUpInFlight = fetchWithWake(`${BASE_URL}/healthz`, { method: 'GET' }, true)
      .catch(() => { /* the real requests will report it */ })
      .finally(() => { warmUpInFlight = null; });
  }
  return warmUpInFlight;
}

// ---- Requests ---------------------------------------------------------------

async function request(endpoint, options = {}) {
  // keepalive: the browser finishes the request even if the page is closing
  // (counter taps flushed on tab hide / close - see useCounter).
  const { auth = true, body, method = 'GET', keepalive = false } = options;
  const retry = options.retry ?? method === 'GET';
  const headers = { 'Content-Type': 'application/json' };

  const tz = timeZone();
  if (tz) headers['X-Timezone'] = tz;

  const token = auth ? getToken() : null;
  if (token) headers['Authorization'] = `JWT ${token}`;

  let res;
  try {
    res = await fetchWithWake(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    }, retry);
  } catch (err) {
    const e = new Error(err.name === 'AbortError' ? ERROR_MAP.timeout : ERROR_MAP.network);
    e.status = 0;
    throw e;
  }

  // Sliding session: the server hands back a fresh token as the old one ages.
  const refreshed = res.headers.get('X-Refreshed-Token');
  if (refreshed && token) setToken(refreshed);

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    const err = new Error(humanizeError(res.status, data));
    err.status = res.status;
    err.raw = data;
    throw err;
  }
  return data;
}

export const api = {
  get:    (url, opts) => request(url, { ...opts, method: 'GET' }),
  post:   (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
  patch:  (url, body, opts) => request(url, { ...opts, method: 'PATCH', body }),
  delete: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
};
