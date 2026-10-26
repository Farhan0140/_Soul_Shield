import AsyncStorage from '@react-native-async-storage/async-storage';

/** User-facing notification/data preferences that outlive query-cache clears
 * (plain AsyncStorage, like the background-sync state). The last-registered
 * Expo push token is kept so toggling cross-device alerts OFF can tell the
 * server exactly which token to delete. */

const DIGEST_ENABLED_KEY = 'soulshield_digest_enabled';
const DIGEST_TIME_KEY = 'soulshield_digest_time'; // "HH:MM"
const PUSH_PREF_KEY = 'soulshield_push_pref';
const PUSH_TOKEN_KEY = 'soulshield_push_token'; // last token registered server-side
const PUSH_PLATFORM_KEY = 'soulshield_push_platform';

export interface DigestPref {
  enabled: boolean;
  hour: number; // 0-23
  minute: number; // 0-59
}

export function getDigestPref(): Promise<DigestPref> {
  return (async () => {
    const [enabledRaw, timeRaw] = await Promise.all([
      AsyncStorage.getItem(DIGEST_ENABLED_KEY),
      AsyncStorage.getItem(DIGEST_TIME_KEY),
    ]);
    const [hour, minute] = (timeRaw ?? '20:00').split(':').map(Number);
    return {
      enabled: enabledRaw === 'true',
      hour: Number.isFinite(hour) ? hour : 20,
      minute: Number.isFinite(minute) ? minute : 0,
    };
  })();
}

export async function setDigestEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DIGEST_ENABLED_KEY, String(enabled));
}

export async function setDigestTime(hour: number, minute: number): Promise<void> {
  await AsyncStorage.setItem(DIGEST_TIME_KEY, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
}

export function getPushPref(): Promise<boolean> {
  return AsyncStorage.getItem(PUSH_PREF_KEY).then((raw) => raw === 'true');
}

export function setPushPref(enabled: boolean): Promise<void> {
  return AsyncStorage.setItem(PUSH_PREF_KEY, String(enabled));
}

export function getRegisteredPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

export function setRegisteredPushToken(token: string, platform: string): Promise<void> {
  return Promise.all([
    AsyncStorage.setItem(PUSH_TOKEN_KEY, token),
    AsyncStorage.setItem(PUSH_PLATFORM_KEY, platform),
  ]).then(() => {});
}

export function clearRegisteredPushToken(): Promise<void> {
  return Promise.all([AsyncStorage.removeItem(PUSH_TOKEN_KEY), AsyncStorage.removeItem(PUSH_PLATFORM_KEY)]).then(
    () => {}
  );
}
