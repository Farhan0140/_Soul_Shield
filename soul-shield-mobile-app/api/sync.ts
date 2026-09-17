import { apiGet, apiPost } from '@/api/client';
import type { SyncChange, SyncChangeResult, SyncSnapshot } from '@/api/sync-types';

/** GET /sync - see soul-shield/rest/handlers/sync/pull.go. Omit `since` for
 * a full pull (first-ever sync on a device); pass the previous response's
 * `cursor` back to pull only what changed since then. */
export function getSyncChanges(since: string | null, token: string | null, timeoutMs?: number) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiGet<SyncSnapshot>(`/sync${query}`, token, timeoutMs);
}

/** POST /sync - see soul-shield/rest/handlers/sync/push.go. Every mutation
 * hook (hooks/queries/use-task-mutations.ts, use-category-mutations.ts)
 * pushes through this - react-query's own mutation queue is what gives it
 * offline durability (paused while offline, replayed on reconnect), same
 * mechanism as before, just calling this instead of the old per-action REST
 * endpoints. */
export async function pushSyncChanges(changes: SyncChange[], token: string | null): Promise<SyncChangeResult[]> {
  const { results } = await apiPost<{ results: SyncChangeResult[] }>('/sync', { changes }, token);
  return results;
}
