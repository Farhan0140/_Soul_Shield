/** Minimal external store (same subscribe/getSnapshot shape `onlineManager`
 * uses, see hooks/use-network-status.ts) tracking the current background
 * sync (today + the forward offline window) phase — read by DateNavHeader to
 * show "Syncing…"/"Synced"/"Sync failed" plus its thin progress indicator.
 * Lives here rather than in state.ts since that module persists sync
 * *outcomes* to disk; this is purely an in-memory, synchronous "what's
 * happening right now" flag with no need to survive a reload — on a fresh
 * app start this is 'idle' until the first sync of the session kicks off,
 * regardless of what happened last session. */

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'failed';

const listeners = new Set<() => void>();
let phase: SyncPhase = 'idle';

export function setSyncPhase(next: SyncPhase): void {
  if (phase === next) return;
  phase = next;
  listeners.forEach((listener) => listener());
}

export function getSyncPhaseSnapshot(): SyncPhase {
  return phase;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
