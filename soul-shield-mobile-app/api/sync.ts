import { apiGet, apiPost, type RetryOptions } from '@/api/client';
import type { GlobalSyncSnapshot, SyncChange, SyncChangeResult, SyncSnapshot } from '@/api/sync-types';

/** GET /sync - see soul-shield/rest/handlers/sync/pull.go. Omit `since` for
 * a full pull (first-ever sync on a device); pass the previous response's
 * `cursor` back to pull only what changed since then. */
export function getSyncChanges(since: string | null, token: string | null, timeoutMs?: number, retry?: RetryOptions) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiGet<SyncSnapshot>(`/sync${query}`, token, timeoutMs, retry);
}

/** GET /sync/global - see soul-shield/rest/handlers/sync/pull_global.go.
 * Public (no token): fixed tasks for devices used without an account. Same
 * `since`/`cursor` contract as getSyncChanges, with its own cursor. */
export function getGlobalSyncChanges(since: string | null, timeoutMs?: number, retry?: RetryOptions) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiGet<GlobalSyncSnapshot>(`/sync/global${query}`, null, timeoutMs, retry);
}

/** POST /sync - see soul-shield/rest/handlers/sync/push.go. Every mutation
 * hook (hooks/queries/use-task-mutations.ts, use-category-mutations.ts)
 * pushes through this - react-query's own mutation queue is what gives it
 * offline durability (paused while offline, replayed on reconnect), same
 * mechanism as before, just calling this instead of the old per-action REST
 * endpoints. */
export async function pushSyncChanges(
  changes: SyncChange[],
  token: string | null,
  retry?: RetryOptions
): Promise<SyncChangeResult[]> {
  const { results } = await apiPost<{ results: SyncChangeResult[] }>('/sync', { changes }, token, retry);
  return results;
}
