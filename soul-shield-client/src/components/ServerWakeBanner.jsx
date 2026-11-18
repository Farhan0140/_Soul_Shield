import { useSyncExternalStore } from 'react';
import { Loader2 } from 'lucide-react';
import { isServerWaking, subscribeServerStatus } from '../services/api';

/**
 * Shown while api.js is retrying through a server cold start (the API host
 * sleeps when idle and takes up to a minute to boot). Without it the first
 * visit of the day just looked frozen or failed with a network error.
 */
export default function ServerWakeBanner() {
  const waking = useSyncExternalStore(subscribeServerStatus, isServerWaking);
  if (!waking) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full shadow-lg bg-surface border border-border text-sm text-fg max-w-[calc(100vw-2rem)]"
    >
      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
      <span>Waking up the server… this can take up to a minute.</span>
    </div>
  );
}
