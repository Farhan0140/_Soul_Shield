import { apiGet } from '@/api/client';
import type { SyncSnapshot } from '@/api/sync-types';

/** GET /sync - see soul-shield/rest/handlers/sync/pull.go. Omit `since` for
 * a full pull (first-ever sync on a device); pass the previous response's
 * `cursor` back to pull only what changed since then. */
export function getSyncChanges(since: string | null, token: string | null, timeoutMs?: number) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiGet<SyncSnapshot>(`/sync${query}`, token, timeoutMs);
}
