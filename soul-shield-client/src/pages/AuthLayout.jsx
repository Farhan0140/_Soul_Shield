import { m } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Check, Hash, Timer, CalendarDays } from 'lucide-react';
import Logo from '../components/ui/Logo';
import BeadString, { BeadMeter } from '../components/BeadString';
import { cn } from '../utils/cn';

// The brand panel always uses the dark (ink) tokens, via data-theme on the
// panel itself, and sits on the deep navy of the app icon.
const FEATURES = [
  { icon: Check, title: 'Daily deeds', body: 'Recurring tasks that reset every day, week, or on the days you pick' },
  { icon: Hash, title: 'Counters', body: 'Tap through dhikr and repetitions, progress syncs as you go' },
  { icon: Timer, title: 'Focus timers', body: 'Timed tasks with a countdown that survives closing the tab' },
  { icon: CalendarDays, title: 'History', body: 'Streaks and a calendar that show how consistent you have been' },
];

/** Carved eight-point-star lattice, the texture of a mashrabiya screen. */
function Lattice() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden="true">
      <defs>
        <pattern id="auth-lattice" width="72" height="72" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="rgba(236,237,240,0.07)" strokeWidth="1">
            <rect x="21" y="21" width="30" height="30" />
            <rect x="21" y="21" width="30" height="30" transform="rotate(45 36 36)" />
            <path d="M0 36h15M57 36h15M36 0v15M36 57v15" />
            <path d="M0 0l10 10M72 0 62 10M0 72l10-10M72 72 62 62" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#auth-lattice)" />
    </svg>
  );
}

/** Tilted product preview: the bead string and three of the day's deeds. */
function PreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-[440px] [perspective:1600px]" aria-hidden="true">
      <div className="absolute inset-x-8 -bottom-4 top-8 rounded-2xl border border-white/[0.05] bg-[#141826] [transform:rotateX(12deg)_rotateY(-16deg)_rotateZ(2deg)]" />
      <div className="relative rounded-2xl border border-white/[0.08] bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_48px_96px_-24px_rgba(0,0,0,0.8)] [transform:rotateX(8deg)_rotateY(-12deg)_rotateZ(1.5deg)]">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-muted">Today's deeds</span>
          <span className="text-xs tabular-nums text-muted">4 of 7</span>
        </div>
        <BeadString total={7} completed={4} partial={1} className="-mx-2 mt-1 h-auto w-[calc(100%+16px)]" />
        <div className="mt-2 space-y-2">
          <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-surface-2 px-3">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-primary">
              <Check className="h-3 w-3 text-on-primary" strokeWidth={3} />
            </span>
            <span className="flex-1 text-[13px] text-muted line-through">Fajr prayer</span>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 px-3 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-fg">Morning adhkar</span>
              <span className="text-[11px] tabular-nums text-muted">66 / 100</span>
            </div>
            <BeadMeter value={66} max={100} limit={20} className="mt-2" label="Morning adhkar progress" />
          </div>
          <div className="flex h-11 items-center gap-3 rounded-xl border border-border bg-surface-2 px-3">
            <Timer className="h-4 w-4 text-muted" strokeWidth={1.75} />
            <span className="flex-1 text-[13px] text-fg">Read Quran</span>
            <span className="text-xs tabular-nums text-fg">12:40</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children, title, subtitle }) {
  const { pathname } = useLocation();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        data-theme="lemon-dark"
        className="relative hidden flex-col justify-between overflow-hidden bg-[#0C1120] p-10 text-fg lg:flex xl:p-14"
      >
        <Lattice />
        <Link to="/" aria-label="SoulShield home" className="relative w-fit rounded-lg">
          <Logo />
        </Link>

        <div className="relative py-12">
          <PreviewCard />
          <h2 className="display mt-16 max-w-md text-[40px] leading-[1.1] text-fg">
            Guard your day, one deed at a time
          </h2>
          <dl className="mt-8 grid max-w-lg grid-cols-2 gap-x-8 gap-y-6">
            {FEATURES.map(({ icon: Icon, title: t, body }) => (
              <div key={t}>
                <dt className="flex items-center gap-2 text-sm font-medium text-fg">
                  <Icon className="h-4 w-4 text-muted" strokeWidth={1.75} aria-hidden="true" /> {t}
                </dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-xs text-subtle">Your tasks stay in sync between the web app and the mobile app</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <m.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          <Link to="/" aria-label="SoulShield home" className="mb-12 inline-block rounded-lg lg:hidden">
            <Logo />
          </Link>

          {title && (
            <div className="mb-8">
              <h1 className="display text-[36px] leading-[1.15]">{title}</h1>
              {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
            </div>
          )}

          {children}
        </m.div>
      </main>
    </div>
  );
}

/** "Step 2 of 3" with a segmented progress bar. */
export function StepIndicator({ steps, step }) {
  return (
    <div className="mb-6 flex items-center gap-3" aria-label={`Step ${step + 1} of ${steps.length}`} role="group">
      <div className="flex flex-1 gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-primary' : 'bg-border')}
          />
        ))}
      </div>
      <span className="text-xs tabular-nums text-muted">
        Step {step + 1} of {steps.length}
      </span>
    </div>
  );
}
