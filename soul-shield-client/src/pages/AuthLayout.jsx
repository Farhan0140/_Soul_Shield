import { m } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Check, Hash, Timer, CalendarDays } from 'lucide-react';
import Logo from '../components/ui/Logo';
import { cn } from '../utils/cn';

// The brand panel is charcoal in both themes, so its colors are fixed here
// rather than taken from the light/dark tokens.
const FEATURES = [
  { icon: Check, title: 'Daily deeds', body: 'Recurring tasks that reset every day, week, or on the days you pick.' },
  { icon: Hash, title: 'Counters', body: 'Tap through dhikr and repetitions — progress syncs as you go.' },
  { icon: Timer, title: 'Focus timers', body: 'Timed tasks with a countdown that survives closing the tab.' },
  { icon: CalendarDays, title: 'History', body: 'Streaks and a heatmap that show how consistent you have been.' },
];

/** Slightly tilted product preview — the one decorative "3D" moment. */
function PreviewCard() {
  return (
    <div className="relative mx-auto w-full max-w-[380px] [perspective:1400px]" aria-hidden="true">
      <div className="absolute inset-x-6 -bottom-3 top-6 rounded-2xl border border-white/[0.06] bg-[#1A1B1E] [transform:rotateX(14deg)_rotateY(-14deg)_rotateZ(2deg)]" />
      <div className="relative rounded-2xl border border-white/10 bg-[#1D1E21] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_40px_80px_-24px_rgba(0,0,0,0.7)] [transform:rotateX(10deg)_rotateY(-12deg)_rotateZ(1.5deg)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#8E9196]">Today</span>
          <span className="text-[11px] tabular-nums text-[#8E9196]">2 of 3 done</span>
        </div>
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full w-2/3 rounded-full bg-[#D2F05A]" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[#D2F05A]">
              <Check className="h-3 w-3 text-[#141904]" strokeWidth={3} />
            </span>
            <span className="flex-1 text-[13px] text-[#8E9196] line-through">Fajr prayer</span>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#ECEDE8]">Morning adhkar</span>
              <span className="text-[11px] tabular-nums text-[#8E9196]">66 / 100</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-[66%] rounded-full bg-[#D2F05A]" />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <Timer className="h-4 w-4 text-[#D2F05A]" />
            <span className="flex-1 text-[13px] text-[#ECEDE8]">Read Quran</span>
            <span className="text-[12px] font-medium tabular-nums text-[#ECEDE8]">12:40</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children, title, subtitle }) {
  const { pathname } = useLocation();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#121314] p-10 text-[#ECEDE8] lg:flex xl:p-14">
        <Link to="/" aria-label="SoulShield home" className="w-fit rounded-lg">
          <Logo wordmarkClassName="text-[#ECEDE8]" />
        </Link>

        <div className="py-10">
          <PreviewCard />
          <h2 className="mt-14 max-w-md text-[28px] font-semibold leading-tight tracking-tight text-[#ECEDE8]">
            Guard your day, one deed at a time.
          </h2>
          <dl className="mt-8 grid max-w-lg grid-cols-2 gap-x-8 gap-y-6">
            {FEATURES.map(({ icon: Icon, title: t, body }) => (
              <div key={t}>
                <dt className="flex items-center gap-2 text-sm font-medium text-[#ECEDE8]">
                  <Icon className="h-4 w-4 text-[#D2F05A]" aria-hidden="true" /> {t}
                </dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-[#8E9196]">{body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-[#6E7176]">Your tasks stay in sync between the web app and the mobile app.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <m.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[400px]"
        >
          <Link to="/" aria-label="SoulShield home" className="mb-10 inline-block rounded-lg lg:hidden">
            <Logo />
          </Link>

          {title && (
            <div className="mb-7">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</p>}
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
            className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-primary-ink' : 'bg-border')}
          />
        ))}
      </div>
      <span className="text-xs font-medium tabular-nums text-muted">
        Step {step + 1} of {steps.length}
      </span>
    </div>
  );
}
