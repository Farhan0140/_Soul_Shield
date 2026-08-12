import { Vibration } from 'react-native';

/** Single short buzz on start — deliberately not expo-haptics' `impactAsync`
 * (see components/haptic-tab.tsx), since that's a discrete tap feel gated to
 * iOS in this app, not a genuine device vibration on both platforms. */
const START_VIBRATION_MS = 80;

/** ~1.5s total, three short pulses with pauses between them (RN's Vibration
 * pattern format alternates [wait, vibrate, wait, vibrate, ...]) — a clearly
 * distinct "timer done" feel without needing sound. */
const COMPLETE_VIBRATION_PATTERN = [0, 300, 150, 300, 150, 300];

export function vibrateStart(enabled: boolean): void {
  if (!enabled) return;
  Vibration.vibrate(START_VIBRATION_MS);
}

export function vibrateComplete(enabled: boolean): void {
  if (!enabled) return;
  Vibration.vibrate(COMPLETE_VIBRATION_PATTERN);
}
