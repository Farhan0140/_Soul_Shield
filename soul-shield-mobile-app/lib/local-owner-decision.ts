/** Pure decision logic for lib/local-owner.ts, kept free of imports so it can
 * be unit-tested directly under Node (tests/local-owner-decision.test.mjs).
 *
 * The on-device store (SQLite + sync cursor + queued pushes) has no per-row
 * owner: it belongs to whichever account is signed in. An expired session
 * (401) signs out but deliberately KEEPS local data so the same user's
 * offline edits survive re-login. That is only safe if the NEXT sign-in is
 * the same account: otherwise the new user would see the previous user's
 * tasks, the previous user's unsynced edits would be pushed into the new
 * account, and the new user's own older data would never be pulled (the
 * sync cursor would be the previous user's). */

export type LocalDataAction = 'keep' | 'wipe';

/**
 * @param storedOwnerId  user id the local data was last recorded for, or null
 *                       if none was recorded (fresh install, explicit logout,
 *                       or an install from before ownership was tracked)
 * @param signingInUserId the account that is signing in now
 * @param localHasData   whether the local store currently holds any rows
 */
export function decideLocalDataAction(
  storedOwnerId: string | null,
  signingInUserId: string,
  localHasData: boolean
): LocalDataAction {
  // Same account: keep everything, including queued offline edits.
  if (storedOwnerId === signingInUserId) return 'keep';
  // Nothing on the device yet: nothing to protect or leak.
  if (storedOwnerId === null && !localHasData) return 'keep';
  // A different account, or data whose owner is unknown: never risk mixing
  // accounts. The server copy is intact; a full pull restores the new
  // user's data.
  return 'wipe';
}
