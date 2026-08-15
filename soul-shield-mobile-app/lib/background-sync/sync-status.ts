/** Minimal external store (same subscribe/getSnapshot shape `onlineManager`
 * uses, see hooks/use-network-status.ts) tracking whether a full background
 * sync (today + the forward offline window) is currently in flight — read by
 * DateNavHeader to show/hide its thin progress indicator. Lives here rather
 * than in state.ts since that module persists sync *outcomes* to disk; this
 * is purely an in-memory, synchronous "is one running right now" flag with
 * no need to survive a reload. */

const listeners = new Set<() => void>();
let syncing = false;

export function setSyncStatus(next: boolean): void {
  if (syncing === next) return;
  syncing = next;
  listeners.forEach((listener) => listener());
}

export function getSyncStatusSnapshot(): boolean {
  return syncing;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
