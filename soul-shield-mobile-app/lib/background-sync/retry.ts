import type { RetryOptions } from '@/api/client';

/** Per-attempt hard ceiling - short enough that a single stuck attempt
 * doesn't eat the whole retry budget, long enough to catch a response that's
 * merely slow rather than a cold instance still spinning up. */
export const SYNC_REQUEST_TIMEOUT_MS = 15_000;

/** Retry policy for every backend call the background sync system makes
 * (the /sync pull, every mutation's push) - rides out a Render free-tier
 * instance waking up from sleep (commonly 30-50s, sometimes more) instead of
 * failing on the first timeout. 5 attempts with delays of 5s, 10s, 15s, 15s
 * between them (~75s of backoff, on top of up to 5 * 15s = 75s of attempts
 * themselves - a worst case around 2.5 minutes) comfortably covers a typical
 * cold start without retrying forever if the server is genuinely down. */
export const SYNC_RETRY: RetryOptions = {
  attempts: 5,
  delayMs: 5_000,
  maxDelayMs: 15_000,
};
