import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Home, CalendarDays } from 'lucide-react';
import Logo from '../components/ui/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link to="/" aria-label="SoulShield home" className="w-fit rounded-lg">
        <Logo />
      </Link>

      <m.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center pb-16 text-center"
      >
        <p className="text-sm font-medium tabular-nums text-primary-ink">Error 404</p>
        <h1 className="display mt-3 text-[36px] leading-[1.15] sm:text-[44px]">This page doesn't exist</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The link may be broken, or the page may have moved. Let's get you back on track.
        </p>

        <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/" className="btn btn-primary btn-lg">
            <Home className="h-4 w-4" /> Back to today
          </Link>
          <Link to="/history" className="btn btn-secondary btn-lg">
            <CalendarDays className="h-4 w-4" /> View history
          </Link>
        </div>
      </m.main>
    </div>
  );
}
