import { cn } from '../../utils/cn';

/** Placeholder block. Sizes come from className (h-*, w-*, rounded-*). */
export function Skeleton({ className = '', style }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} style={style} />;
}

/** Wraps a skeleton layout so assistive tech hears "Loading…" once. */
export function SkeletonGroup({ label = 'Loading…', className = '', children }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Mirrors TaskCard: meta row, title, description, footer actions. */
export function TaskCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 h-5 w-5 rounded-md" />
        <div className="flex-1 space-y-2.5">
          <div className="flex gap-2">
            <Skeleton className="h-[18px] w-20" />
            <Skeleton className="h-[18px] w-12" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <Skeleton className="h-7 w-14" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  );
}

/** Mirrors a card holding a list of rows (dashboard groups, settings lists). */
export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="card divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
          </div>
          <Skeleton className="h-5 w-8" />
        </div>
      ))}
    </div>
  );
}

/** Mirrors StatCard. */
export function StatCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <Skeleton className="mb-4 h-9 w-9 rounded-lg" />
      <Skeleton className="mb-2 h-3 w-1/2" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

export function StatGridSkeleton({ count = 4, className = 'grid grid-cols-2 gap-3 lg:grid-cols-4' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
  );
}

/** Generic page placeholder (title, intro line, a few cards) shown while a
 * page's code chunk loads on first visit. */
export function PageSkeleton() {
  return (
    <SkeletonGroup label="Loading page…" className="space-y-6">
      <div className="space-y-2.5">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
        <TaskCardSkeleton />
      </div>
    </SkeletonGroup>
  );
}
