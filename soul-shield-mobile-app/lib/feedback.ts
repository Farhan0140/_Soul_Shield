import * as Haptics from 'expo-haptics';

import { isCounterHapticsEnabled } from '@/lib/haptics-pref';

/** Light impact for quick taps that acknowledged a change (counter taps,
 * ticking a sub-task) — silently no-ops where haptics aren't available. */
export function hapticLight(): void {
  // User-facing counter-vibration toggle (Profile → Appearance): when off,
  // counter taps, quick-adds and check-offs stay silent. Reward haptics
  // (hapticSuccess) are a separate, always-on celebration.
  if (!isCounterHapticsEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success feedback for a meaningful completion (finishing a task, reward) —
 * the platform's success triple-pulse. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
