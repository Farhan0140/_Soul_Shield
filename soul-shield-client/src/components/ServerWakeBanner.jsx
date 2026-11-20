import { useSyncExternalStore } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { isServerWaking, subscribeServerStatus } from '../services/api';
import Spinner from './ui/Spinner';

/**
 * Small status pill shown while api.js is retrying through a server cold
 * start (the API host sleeps when idle and can take up to a minute to boot).
 * It fades in after a short delay, so a quick retry never flashes it, and the
 * page underneath keeps its skeletons instead of being replaced.
 */
export default function ServerWakeBanner() {
  const waking = useSyncExternalStore(subscribeServerStatus, isServerWaking);

  return (
    <AnimatePresence>
      {waking && (
        <m.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.6, duration: 0.25 } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
          className="popover-surface fixed top-[calc(4rem+env(safe-area-inset-top))] left-1/2 z-[150] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full py-2 pr-4 pl-2.5 lg:top-4"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
            <Spinner size={14} />
          </span>
          <span className="min-w-0 text-[13px] leading-tight">
            <span className="block font-medium text-fg">Connecting to the server…</span>
            <span className="block text-muted">It was asleep — this can take up to a minute.</span>
          </span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
