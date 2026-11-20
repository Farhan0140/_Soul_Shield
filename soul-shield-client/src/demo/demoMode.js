/**
 * Demo ("Take a tour") mode.
 *
 * A visitor can explore the whole app with sample data and no account. Demo
 * mode is scoped to the browser tab (sessionStorage) and decided once per page
 * load: entering or leaving it does a full navigation, so no state from a real
 * session can leak into the demo or the other way round. While it is on, the
 * ApiProvider serves the in-browser demo API (demoApi.js) instead of the real
 * server: nothing is sent over the network and no real account is touched.
 */

const DEMO_KEY = 'soulshield_demo';
export const DEMO_STORE_KEY = 'soulshield_demo_store';
export const DEMO_ONBOARDING_KEY = 'soulshield_demo_onboarding_seen';

function readFlag() {
  try {
    return sessionStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

const active = readFlag();

/** True when this page load is running the demo. */
export function isDemoMode() {
  return active;
}

function clearDemoStorage() {
  try {
    sessionStorage.removeItem(DEMO_KEY);
    sessionStorage.removeItem(DEMO_STORE_KEY);
    sessionStorage.removeItem(DEMO_ONBOARDING_KEY);
  } catch {
    /* storage blocked */
  }
}

/** Starts a fresh demo (new sample data, tour shown again) and opens the dashboard.
 * Returns false when the browser blocks session storage, so the demo can't
 * survive the reload. */
export function startDemo() {
  clearDemoStorage();
  try {
    sessionStorage.setItem(DEMO_KEY, '1');
  } catch {
    return false;
  }
  window.location.assign('/');
  return true;
}

/** Leaves the demo, discards its data and goes to `to` (sign-in by default). */
export function exitDemo(to = '/login') {
  clearDemoStorage();
  window.location.assign(to);
}

/** Throws the demo's sample data away and starts over on the dashboard. */
export function resetDemo() {
  try {
    sessionStorage.removeItem(DEMO_STORE_KEY);
  } catch {
    /* storage blocked */
  }
  window.location.assign('/');
}
