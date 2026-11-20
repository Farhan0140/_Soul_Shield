import { Compass, RotateCcw, LogOut, UserPlus } from 'lucide-react';
import { isDemoMode, exitDemo, resetDemo } from '../demo/demoMode';
import Button from './ui/Button';
import Tooltip from './ui/Tooltip';

/** Shown at the top of every page during the tour, so a visitor always knows
 * they're looking at sample data and how to get out (or sign up). */
export default function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <section
      aria-label="Demo mode"
      className="mx-auto mb-6 flex max-w-6xl flex-col gap-3 rounded-xl border border-primary-ink/20 bg-primary-soft px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span className="icon-tile icon-tile-accent h-8 w-8 shrink-0">
          <Compass className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="min-w-0 text-[13px] leading-snug text-fg-2">
          <strong className="font-semibold text-fg">You’re taking a tour.</strong>{' '}
          Everything here is sample data that stays in this tab — try anything, nothing is saved to a real account.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
        <Tooltip label="Reset sample data">
          <Button variant="ghost" size="sm" iconOnly onClick={resetDemo} aria-label="Reset sample data">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Button variant="ghost" size="sm" onClick={() => exitDemo('/login')}>
          <LogOut className="h-3.5 w-3.5" /> Exit
        </Button>
        <Button size="sm" onClick={() => exitDemo('/register')}>
          <UserPlus className="h-3.5 w-3.5" /> Create account
        </Button>
      </div>
    </section>
  );
}
