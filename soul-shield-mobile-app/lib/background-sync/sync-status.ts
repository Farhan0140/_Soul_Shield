/** Minimal external store (same subscribe/getSnapshot shape `onlineManager`
 * uses, see hooks/use-network-status.ts) tracking whether there is any real
 * backend API call in flight right now - the periodic /sync pull (see
 * lib/background-sync/sync.ts) AND every mutation's push (see
 * lib/mutation-defaults.ts's pushChanges, the single choke point every
 * create/edit/delete/complete/increment push funnels through) both call
 * beginSyncActivity/endSyncActivity around their network call, so
 * DateNavHeader's "Syncing…"/"Synced"/"Sync failed" label reflects any of
 * them, not just the periodic pull. Lives here rather than in state.ts since
 * that module persists sync *outcomes* to disk; this is purely an
 * in-memory, synchronous "what's happening right now" flag with no need to
 * survive a reload — on a fresh app start this is 'idle' until the first
 * real network attempt of the session, regardless of what happened last
 * session. */

export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'failed';

const listeners = new Set<() => void>();
let phase: SyncPhase = 'idle';

// How many calls are between their beginSyncActivity() and
// endSyncActivity() right now - several mutations pushing at once (e.g.
// completing two tasks quickly, or a mutation push racing the periodic
// pull) all count as one ongoing "Syncing…" that only clears once the LAST
// one settles, rather than flickering between phases as each individually
// starts/stops.
let activeCount = 0;
// Whether anything in the current burst (the span from activeCount 0->1
// until it returns to 0) has failed - determines whether the label reads
// "Synced" or "Sync failed" once the burst ends. Reset at the start of each
// new burst so an old failure doesn't linger onto an unrelated later one.
let hadFailureThisBurst = false;

function setPhase(next: SyncPhase): void {
  if (phase === next) return;
  phase = next;
  listeners.forEach((listener) => listener());
}

export function beginSyncActivity(): void {
  activeCount += 1;
  if (activeCount === 1) {
    hadFailureThisBurst = false;
    setPhase('syncing');
  }
}

export function endSyncActivity(success: boolean): void {
  if (!success) hadFailureThisBurst = true;
  activeCount = Math.max(activeCount - 1, 0);
  if (activeCount === 0) {
    setPhase(hadFailureThisBurst ? 'failed' : 'synced');
  }
}

export function getSyncPhaseSnapshot(): SyncPhase {
  return phase;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
