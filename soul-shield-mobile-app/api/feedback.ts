import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { apiPost } from '@/api/client';
import { newUuid } from '@/lib/db/uuid';
import { ApiError } from '@/lib/errors';

/**
 * App rating + feedback (Profile -> Rate & feedback). Works with or without
 * an account: signed in, the server files it under the account; as a guest
 * it goes under this phone's random device id, which admins see as
 * "guest-user-<n>". Each person counts once in the star totals (their latest
 * rating), so rating again just replaces the old vote.
 *
 * One submission per 24 hours. The server enforces it (per account / guest
 * device); the app remembers when the next one is allowed so it can say so
 * up front instead of letting someone type a message that gets refused.
 */

// Device-scoped, NOT user-scoped: kept across sign-in/out so a phone stays
// the same guest-user-<n> (deliberately not in lib/local-owner.ts's
// USER_SCOPED_KEYS).
const DEVICE_ID_KEY = 'soulshield_feedback_device_id';
// The last rating sent from this phone, to show the stars filled in.
const LAST_RATING_KEY = 'soulshield_feedback_last_rating';
// ISO time the next submission is allowed (user-scoped, like the rating).
const NEXT_ALLOWED_KEY = 'soulshield_feedback_next_allowed_at';

export const FEEDBACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Thrown by submitFeedback when this person already sent feedback in the
 * last 24 hours. */
export class FeedbackCooldownError extends Error {
  constructor(readonly nextAllowedAt: Date) {
    super('feedback_cooldown');
    this.name = 'FeedbackCooldownError';
  }
}

/** When this phone's person may send feedback again, or null if they can now. */
export async function getFeedbackNextAllowedAt(): Promise<Date | null> {
  try {
    const raw = await AsyncStorage.getItem(NEXT_ALLOWED_KEY);
    const at = raw ? new Date(raw) : null;
    return at && !Number.isNaN(at.getTime()) && at.getTime() > Date.now() ? at : null;
  } catch {
    return null;
  }
}

async function setNextAllowedAt(at: Date): Promise<void> {
  await AsyncStorage.setItem(NEXT_ALLOWED_KEY, at.toISOString()).catch(() => {});
}

/** The server's 429 for "already sent today" (not the generic rate limit). */
function cooldownFrom(error: unknown): Date | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  const payload = error.payload as { code?: string; next_allowed_at?: string } | undefined;
  if (payload?.code !== 'feedback_cooldown' || !payload.next_allowed_at) return null;
  const at = new Date(payload.next_allowed_at);
  return Number.isNaN(at.getTime()) ? null : at;
}

export const MAX_FEEDBACK_LENGTH = 2000;

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = newUuid();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export async function getLastRating(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_RATING_KEY);
    const n = raw ? Number(raw) : NaN;
    return n >= 1 && n <= 5 ? n : null;
  } catch {
    return null;
  }
}

export async function submitFeedback(rating: number, message: string, token: string | null): Promise<void> {
  const blockedUntil = await getFeedbackNextAllowedAt();
  if (blockedUntil) throw new FeedbackCooldownError(blockedUntil);

  const trimmed = message.trim();
  try {
    await apiPost<{ id: number }>(
      '/feedback',
      {
        rating,
        ...(trimmed ? { message: trimmed } : {}),
        // Only used when there's no token (guest).
        device_id: await getDeviceId(),
        platform: Platform.OS,
      },
      token,
    );
  } catch (error) {
    // Sent from another phone / before reinstalling: take the server's word.
    const serverNext = cooldownFrom(error);
    if (serverNext) {
      await setNextAllowedAt(serverNext);
      throw new FeedbackCooldownError(serverNext);
    }
    throw error;
  }
  await setNextAllowedAt(new Date(Date.now() + FEEDBACK_COOLDOWN_MS));
  await AsyncStorage.setItem(LAST_RATING_KEY, String(rating)).catch(() => {});
}

/** "in 5 hours" / "in 40 minutes" style wait, rounded up. */
export function formatWait(until: Date, now = Date.now()): { hours: number; minutes: number } {
  const totalMinutes = Math.max(1, Math.ceil((until.getTime() - now) / 60000));
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
