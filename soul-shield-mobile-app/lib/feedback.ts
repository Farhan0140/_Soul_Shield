import * as Haptics from 'expo-haptics';

/** Light impact for quick taps that acknowledged a change (counter taps,
 * ticking a sub-task) — silently no-ops where haptics aren't available. */
export function hapticLight(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success feedback for a meaningful completion (finishing a task, reward) —
 * the platform's success triple-pulse. */
export function hapticSuccess(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
