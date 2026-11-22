import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useApi } from './ApiContext';
import { useToast } from '../components/Toast';

/** In-panel notification for new app ratings/feedback (admins only).
 *
 * Polls the unread count while an admin is signed in: on load, every
 * minute, and when the tab regains focus. The count shows as a badge on the
 * sidebar/bottom-bar "Feedback" link, and a toast announces new submissions
 * (once on sign-in if any are waiting, then whenever the count goes up).
 * Opening the Feedback page marks everything seen (markAllRead). */

const POLL_MS = 60_000;

const FeedbackNotificationsContext = createContext({ unread: 0, markAllRead: async () => {}, refresh: () => {} });

export function FeedbackNotificationsProvider({ children }) {
  const { isAdmin } = useAuth();
  const { getFeedbackUnreadCount, markFeedbackRead } = useApi();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  // null until the first successful check, so the sign-in toast fires once.
  const lastSeen = useRef(null);

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { unread: count = 0 } = (await getFeedbackUnreadCount()) ?? {};
      const previous = lastSeen.current;
      lastSeen.current = count;
      setUnread(count);
      if (count > 0 && (previous === null || count > previous)) {
        const fresh = previous === null ? count : count - previous;
        toast.info(
          previous === null
            ? `You have ${count} new rating${count === 1 ? '' : 's'}/feedback to review.`
            : `New rating/feedback received (${fresh} new).`
        );
      }
    } catch {
      // Best effort: the next poll tries again.
    }
  }, [isAdmin, getFeedbackUnreadCount, toast]);

  useEffect(() => {
    if (!isAdmin) {
      lastSeen.current = null;
      return undefined;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first fetch of the poll this effect starts
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAdmin, refresh]);

  const markAllRead = useCallback(async () => {
    try {
      await markFeedbackRead();
      lastSeen.current = 0;
      setUnread(0);
    } catch {
      // Leave the badge; the page still shows the items.
    }
  }, [markFeedbackRead]);

  const value = useMemo(() => ({ unread: isAdmin ? unread : 0, markAllRead, refresh }), [isAdmin, unread, markAllRead, refresh]);
  return <FeedbackNotificationsContext.Provider value={value}>{children}</FeedbackNotificationsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the provider's hook lives beside it
export const useFeedbackNotifications = () => useContext(FeedbackNotificationsContext);
