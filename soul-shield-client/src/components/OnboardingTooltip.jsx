import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';

const TIPS = [
  {
    emoji: '👋',
    title: 'Welcome to SoulShield!',
    body: "We're here to help you build better daily habits. Let's start with your first task.",
  },
  {
    emoji: '✨',
    title: 'Tap the + button',
    body: "Create a task — like 'Fajr prayer' or 'Read 10 pages'. You can set it to repeat daily.",
  },
  {
    emoji: '🎯',
    title: 'Track your progress',
    body: "Check off tasks as you complete them. Counter tasks (like dhikr) let you tap to count.",
  },
  {
    emoji: '📅',
    title: 'Look back anytime',
    body: "The History page shows your streaks and completion heatmap. Keep going!",
  },
];

export default function OnboardingTooltip() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('soulshield_onboarding_seen');
    if (!seen) {
      // Delay slightly so the page loads first
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = (completed = false) => {
    setShow(false);
    localStorage.setItem('soulshield_onboarding_seen', '1');
  };

  const next = () => {
    if (step < TIPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss(true);
    }
  };

  const tip = TIPS[step];

  return (
    <AnimatePresence>
      {show && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm"
          onClick={() => dismiss()}
        >
          <m.div
            initial={{ y: 40, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 pt-4">
              {TIPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'
                  }`}
                />
              ))}
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={() => dismiss()}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-bg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-muted" />
            </button>

            {/* Content */}
            <div className="p-6 text-center">
              <m.div
                key={step}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl mb-3"
              >
                {tip.emoji}
              </m.div>
              <h3 className="text-lg font-bold text-fg mb-1.5">{tip.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{tip.body}</p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(s => s - 1)}
                  className="px-3 py-2 text-sm text-muted hover:text-fg font-medium"
                >
                  Back
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => dismiss()}
                className="px-3 py-2 text-sm text-muted hover:text-fg font-medium"
              >
                Skip
              </button>
              <m.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-shadow"
              >
                {step === TIPS.length - 1 ? "Let's go!" : 'Next'}
                <ArrowRight className="w-4 h-4" />
              </m.button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}