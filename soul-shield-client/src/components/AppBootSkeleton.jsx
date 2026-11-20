import { Skeleton, SkeletonGroup, ListSkeleton } from './ui/Skeleton';
import Logo from './ui/Logo';

/**
 * Shown while the saved session is being checked on startup (which can sit
 * through a server cold start). It has the same frame as the signed-in app
 * (sidebar, header, page) so nothing jumps when the real UI arrives.
 */
export default function AppBootSkeleton() {
  return (
    <SkeletonGroup label="Loading your workspace…" className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="space-y-2 px-6 pt-4">
          <Skeleton className="mb-4 h-3 w-20" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </aside>

      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
        <Logo size="sm" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </header>

      <main className="px-4 pt-6 sm:px-6 lg:pl-[calc(248px+2.5rem)] lg:pr-10 lg:pt-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-[84px] w-full rounded-[0.875rem]" />
          <ListSkeleton rows={4} />
        </div>
      </main>
    </SkeletonGroup>
  );
}
