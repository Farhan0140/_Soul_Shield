import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient, type Mutation } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getErrorMessage } from '@/lib/errors';

const DISMISSED_KEY = 'soulshield_dismissed_sync_notifications';

export interface SyncNotificationItem {
  id: number;
  domain: string;
  errorMessage: string;
  failedAt: number;
}

interface SyncNotificationsContextValue {
  items: SyncNotificationItem[];
  unreadCount: number;
  retry: (id: number) => void;
  dismiss: (id: number) => void;
  dismissAll: () => void;
}

const SyncNotificationsContext = createContext<SyncNotificationsContextValue | null>(null);

function toItem(mutation: Mutation): SyncNotificationItem {
  const key = mutation.options.mutationKey;
  return {
    id: mutation.mutationId,
    domain: Array.isArray(key) ? String(key[0]) : 'sync',
    errorMessage: getErrorMessage(mutation.state.error),
    failedAt: mutation.state.submittedAt,
  };
}

export function SyncNotificationsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [items, setItems] = useState<SyncNotificationItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((raw) => {
      if (raw) {
        try {
          setDismissedIds(new Set(JSON.parse(raw) as number[]));
        } catch {
          // ignore corrupt data
        }
      }
      setHydrated(true);
    });
  }, []);

  const recompute = useCallback(() => {
    // A mutation that's isPaused (still offline, will auto-retry) is
    // deliberately excluded — only a mutation that was actually retried and
    // still failed (e.g. a 400/409 surfaced after reconnect) belongs here.
    const failed = queryClient
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === 'error' && !m.state.isPaused)
      .map(toItem);
    setItems(failed);
  }, [queryClient]);

  useEffect(() => {
    recompute();
    // MutationCache can notify synchronously while a *different* component is
    // still rendering (e.g. a new useMutation mounting its MutationObserver
    // elsewhere in the tree) — updating state directly from that callback
    // trips React's cross-component setState-during-render warning. Defer to
    // a macrotask so this always runs after the current render/commit finishes.
    return queryClient.getMutationCache().subscribe(() => {
      setTimeout(recompute, 0);
    });
  }, [queryClient, recompute]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(dismissedIds)));
  }, [dismissedIds, hydrated]);

  const visibleItems = useMemo(
    () => items.filter((item) => !dismissedIds.has(item.id)),
    [items, dismissedIds]
  );

  const retry = useCallback(
    (id: number) => {
      const mutation = queryClient.getMutationCache().getAll().find((m) => m.mutationId === id);
      mutation?.execute(mutation.state.variables).catch(() => {});
    },
    [queryClient]
  );

  const dismiss = useCallback((id: number) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((item) => next.add(item.id));
      return next;
    });
  }, [visibleItems]);

  const value = useMemo<SyncNotificationsContextValue>(
    () => ({ items: visibleItems, unreadCount: visibleItems.length, retry, dismiss, dismissAll }),
    [visibleItems, retry, dismiss, dismissAll]
  );

  return (
    <SyncNotificationsContext.Provider value={value}>{children}</SyncNotificationsContext.Provider>
  );
}

export function useSyncNotifications() {
  const ctx = useContext(SyncNotificationsContext);
  if (!ctx) throw new Error('useSyncNotifications must be used within a SyncNotificationsProvider');
  return ctx;
}
