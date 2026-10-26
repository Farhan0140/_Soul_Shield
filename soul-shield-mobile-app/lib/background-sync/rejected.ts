/** External store (subscribe/getSnapshot — same shape as sync-status.ts) of
 * push results the server REJECTED (validation/ownership failures, one per
 * change — see repo/sync_push.go's per-change result contract). A rejected
 * change stays local forever and is retried on every sync while nothing
 * tells the user: this store is what the "Sync Issues" screen (#10) lists,
 * with the reason, so the failure is no longer invisible. In-memory only —
 * the authoritative state lives in the local rows themselves (still
 * syncedAt: null); clearing the list here never re-anchors anything. */

export interface RejectedChange {
  resource: string;
  uuid: string;
  op: string;
  error: string;
  at: number;
}

const MAX_ITEMS = 30;

const listeners = new Set<() => void>();
const items = new Map<string, RejectedChange>(); // keyed by resource|uuid — re-rejections update in place

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function recordRejectedChange(change: Omit<RejectedChange, 'at'>): void {
  const key = `${change.resource}|${change.uuid}`;
  const existing = items.get(key);
  if (existing && existing.error === change.error) {
    existing.at = Date.now();
    notify();
    return;
  }
  items.set(key, { ...change, at: Date.now() });
  if (items.size > MAX_ITEMS) {
    // Drop the oldest entry (Map preserves insertion order).
    const oldestKey = items.keys().next().value;
    if (oldestKey !== undefined) items.delete(oldestKey);
  }
  notify();
}

export function listRejectedChanges(): RejectedChange[] {
  return [...items.values()].sort((a, b) => b.at - a.at);
}

export function clearRejectedChanges(): void {
  items.clear();
  notify();
}

export function subscribeRejectedChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
