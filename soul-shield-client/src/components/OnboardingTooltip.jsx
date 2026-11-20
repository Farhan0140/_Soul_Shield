import { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import { ArrowRight, ArrowLeft, Hand, Plus, Target, CalendarDays, ListChecks, Timer } from 'lucide-react';
import { isDemoMode, DEMO_ONBOARDING_KEY } from '../demo/demoMode';
import Modal, { ModalBody, ModalFooter } from './ui/Modal';
import Button from './ui/Button';
import { cn } from '../utils/cn';

const SEEN_KEY = 'soulshield_onboarding_seen';

// In the tour, the walkthrough introduces the sample data and is shown once
// per tour (session storage) rather than once per browser.
const DEMO = isDemoMode();
const storage = () => (DEMO ? sessionStorage : localStorage);
const seenKey = DEMO ? DEMO_ONBOARDING_KEY : SEEN_KEY;

const DEMO_TIPS = [
  {
    icon: Hand,
    title: 'Welcome to the SoulShield tour',
    body: 'A sandbox with sample tasks. Tap, count and complete anything you like, nothing here touches a real account.',
  },
  {
    icon: ListChecks,
    title: 'Every kind of task',
    body: 'Salat has a sub-task for each prayer, Morning dhikr counts to 100, and the Workout mixes push-up counters with a plank timer.',
  },
  {
    icon: Timer,
    title: 'Counters and timers',
    body: 'Open Read Quran to run a focus timer, or tap a counter to add one, ten or thirty-three at a time.',
  },
  {
    icon: CalendarDays,
    title: 'Look back anytime',
    body: 'History has four months of sample streaks. As an admin you can also manage the fixed tasks everyone sees.',
  },
];

const STANDARD_TIPS = [
  {
    icon: Hand,
    title: 'Your daily deeds in one place',
    body: 'Prayers, dhikr, Quran reading and any habit you want to keep. Start by adding your first task.',
  },
  {
    icon: Plus,
    title: 'Add a task',
    body: "Use New task to add something like Fajr prayer or Read 10 pages, and set it to repeat.",
  },
  {
    icon: Target,
    title: 'Track your progress',
    body: 'Check off tasks as you finish them. Each one adds a bead to the day, and counters let you tap through dhikr.',
  },
  {
    icon: CalendarDays,
    title: 'Look back anytime',
    body: 'History shows your streaks and a calendar of every day you showed up.',
  },
];

const TIPS = DEMO ? DEMO_TIPS : STANDARD_TIPS;

function readSeen() {
  try {
    return !!storage().getItem(seenKey);
  } catch {
    return true; // storage blocked: don't nag every load
  }
}

export default function OnboardingTooltip() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!readSeen()) {
      // Delay slightly so the page loads first
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      storage().setItem(seenKey, '1');
    } catch {
      /* storage unavailable — nothing to persist */
    }
  };

  const next = () => {
    if (step < TIPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const tip = TIPS[step];
  const Icon = tip.icon;

  return (
    <Modal open={show} onClose={dismiss} size="sm" ariaLabel="Getting started">
      <ModalBody className="pt-2 text-center">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {TIPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-colors duration-200',
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border-strong'
              )}
            />
          ))}
        </div>

        <m.div
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pt-6 pb-2"
        >
          <span className="icon-tile mx-auto h-12 w-12 rounded-xl text-primary-ink">
            <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <h2 className="display mt-4 text-2xl text-fg">{tip.title}</h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">{tip.body}</p>
          <p className="mt-3 text-xs text-subtle" aria-live="polite">
            Step {step + 1} of {TIPS.length}
          </p>
        </m.div>
      </ModalBody>

      <ModalFooter className="sm:justify-between">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={dismiss}>
              Skip
            </Button>
          )}
        </div>
        <Button onClick={next} data-autofocus>
          {step === TIPS.length - 1 ? 'Start' : 'Next'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </ModalFooter>
    </Modal>
  );
}
