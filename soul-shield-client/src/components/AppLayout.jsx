import { useEffect, Suspense } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import DemoBanner from './DemoBanner';
import { m } from 'framer-motion';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';
import Logo from './ui/Logo';
import Avatar from './ui/Avatar';
import Popover from './ui/Popover';
import { PageSkeleton } from './ui/Skeleton';

/** Account menu in the mobile header (the sidebar shows this on desktop). */
function MobileAccountMenu() {
  const { user, logout } = useAuth();
  return (
    <Popover
      label="Account"
      align="end"
      panelClassName="w-64 p-1.5"
      trigger={(props) => (
        <button {...props} type="button" aria-label="Account menu" className="rounded-full">
          <Avatar name={user?.full_name} size={32} />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-fg">{user?.full_name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            to="/profile"
            onClick={() => close()}
            className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-fg-2 transition-colors hover:bg-sunken hover:text-fg"
          >
            <User className="h-4 w-4 text-muted" /> Profile & settings
          </Link>
          <button
            type="button"
            onClick={() => { close(); logout(); }}
            className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </>
      )}
    </Popover>
  );
}

export default function AppLayout() {
  const { pathname } = useLocation();

  // A new page starts at the top instead of inheriting the old scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <Sidebar />

      <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:hidden">
        <Link to="/" aria-label="SoulShield home" className="rounded-lg">
          <Logo size="sm" />
        </Link>
        <MobileAccountMenu />
      </header>

      <main className="px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 lg:pl-[calc(248px+2.5rem)] lg:pr-10 lg:pt-10 lg:pb-14">
        <DemoBanner />
        <m.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-6xl"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </m.div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
