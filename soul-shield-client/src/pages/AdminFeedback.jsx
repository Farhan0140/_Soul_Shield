import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Star, Smartphone } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useFeedbackNotifications } from '../context/FeedbackNotificationsContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import PageHeader, { SectionHeader } from '../components/ui/PageHeader';
import { EmptyState, ErrorState } from '../components/ui/States';
import { Skeleton, SkeletonGroup } from '../components/ui/Skeleton';
import { cn } from '../utils/cn';

function Stars({ value, size = 'h-4 w-4' }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(size, n <= value ? 'fill-warning text-warning' : 'text-border')}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Star totals: one vote per person (their latest rating). */
function RatingSummary({ summary }) {
  const total = summary?.total ?? 0;
  return (
    <section aria-label="Rating summary" className="card grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
      <div className="flex flex-col items-center gap-1.5 sm:min-w-[160px]">
        <p className="text-4xl font-semibold tabular-nums text-fg">{total ? summary.average.toFixed(1) : '–'}</p>
        <Stars value={Math.round(summary?.average ?? 0)} size="h-5 w-5" />
        <p className="text-[13px] text-muted">
          {total} {total === 1 ? 'person' : 'people'} rated
        </p>
      </div>
      <ul className="space-y-2">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = summary?.counts?.[stars] ?? 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <li key={stars} className="flex items-center gap-3 text-[13px]">
              <span className="w-12 shrink-0 text-fg-2 tabular-nums">{stars} star</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                <span className="block h-full rounded-full bg-warning" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted">{count}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FeedbackItem({ item }) {
  return (
    <li className="card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Stars value={item.rating} />
        <span className="min-w-0 truncate text-sm font-medium text-fg">{item.submitter}</span>
        {item.is_guest ? <Badge tone="neutral">Guest</Badge> : null}
        {!item.read ? <Badge tone="primary">New</Badge> : null}
        <span className="ml-auto text-xs text-muted">{formatWhen(item.created_at)}</span>
      </div>
      {item.message ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-2">{item.message}</p>
      ) : (
        <p className="text-[13px] italic text-muted">Rating only, no message.</p>
      )}
      {item.email || item.platform ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {item.email ? <a href={`mailto:${item.email}`} className="hover:text-fg hover:underline">{item.email}</a> : null}
          {item.platform ? (
            <span className="inline-flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> {item.platform}
            </span>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}

/** Admin: ratings + feedback sent from the mobile app (Profile -> Rate &
 * feedback). Opening this page clears the "new feedback" notification. */
export default function AdminFeedback() {
  const { getFeedback } = useApi();
  const { markAllRead } = useFeedbackNotifications();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for the fetch this effect starts
    setError(null);
    getFeedback()
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Seen now. The list keeps its "New" tags for this visit.
        if (res.unread > 0) markAllRead();
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [getFeedback, markAllRead, reloadKey]);

  const loadMore = useCallback(async () => {
    if (!data?.next_before) return;
    setLoadingMore(true);
    try {
      const res = await getFeedback(data.next_before);
      setData((prev) => ({ ...prev, items: [...prev.items, ...res.items], next_before: res.next_before }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [data, getFeedback]);

  const items = data?.items ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Ratings & feedback"
        description="What people say from the mobile app, signed in or as guests"
      />

      {error && !data ? (
        <ErrorState title="Couldn't load feedback" message={error} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !data ? (
        <SkeletonGroup label="Loading feedback…" className="space-y-3">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </SkeletonGroup>
      ) : (
        <>
          <RatingSummary summary={data.summary} />

          <section aria-label="Submissions" className="space-y-3">
            <SectionHeader title="Submissions" meta={`${data.summary?.total ?? 0} rated`} />
            {items.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No feedback yet"
                description="Ratings and messages sent from the app's Profile page will show up here."
              />
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <FeedbackItem key={item.id} item={item} />
                ))}
              </ul>
            )}
            {data.next_before ? (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                  Load older
                </Button>
              </div>
            ) : null}
            {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
          </section>
        </>
      )}
    </div>
  );
}
