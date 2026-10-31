import AsyncStorage from '@react-native-async-storage/async-storage';

/** Counter-haptic preference (#vibration-toggle): gates the short vibration on
 * counter taps / quick-adds / completion check-offs. Cached in-module so the
 * synchronous hapticLight() can consult it without awaiting — the stored value
 * is loaded once at app start (module import) and kept in sync by Profile. */

const KEY = 'soulshield_counter_haptics';

let enabled = true;

export async function loadCounterHapticsPref(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw !== null) enabled = raw === 'true';
  } catch {
    // keep default
  }
  return enabled;
}

export function getCounterHapticsPref(): boolean {
  return enabled;
}

export function isCounterHapticsEnabled(): boolean {
  return enabled;
}

export async function setCounterHapticsPref(value: boolean): Promise<void> {
  enabled = value;
  await AsyncStorage.setItem(KEY, String(value));
}

// Load the stored preference once at import (app start) so early taps honor it.
void loadCounterHapticsPref();
