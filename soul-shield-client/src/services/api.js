// Central API client with friendly, human-readable error messages
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Map backend error codes/messages to warm, understandable text
const ERROR_MAP = {
  400: "Hmm, that doesn't look quite right — please double-check what you entered.",
  401: "We don't recognize those credentials. Mind trying again?",
  403: "You don't have permission to do that right now.",
  404: "We looked everywhere, but couldn't find what you're asking for.",
  409: "That already exists — maybe try something different?",
  500: "Something went wrong on our end. We're on it — please try again in a moment.",
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
  'task not scheduled': "This task isn't scheduled for that day.",
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
  return ERROR_MAP[status] || ERROR_MAP[500];
}

async function request(endpoint, options = {}) {
  const { auth = true, body, method = 'GET' } = options;
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = localStorage.getItem('soulshield_token');
    if (token) headers['Authorization'] = `JWT ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const friendly = humanizeError(res.status, data);
      const err = new Error(friendly);
      err.status = res.status;
      err.raw = data;
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      const e = new Error(ERROR_MAP.timeout);
      e.status = 0;
      throw e;
    }
    if (err instanceof TypeError && err.message.includes('fetch')) {
      const e = new Error(ERROR_MAP.network);
      e.status = 0;
      throw e;
    }
    throw err;
  }
}

export const api = {
  get:    (url, opts) => request(url, { ...opts, method: 'GET' }),
  post:   (url, body, opts) => request(url, { ...opts, method: 'POST', body }),
  patch:  (url, body, opts) => request(url, { ...opts, method: 'PATCH', body }),
  delete: (url, opts) => request(url, { ...opts, method: 'DELETE' }),
};