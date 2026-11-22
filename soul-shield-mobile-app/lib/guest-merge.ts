import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq, isNull } from 'drizzle-orm';

import { getLocalDb } from '@/lib/db/client';
import { categories, tasks } from '@/lib/db/schema';
import { planGuestCategoryMerge } from '@/lib/guest-merge-plan';

/**
 * Guest -> account upload.
 *
 * Someone can track everything without an account (guest mode). When they
 * later sign in, their local data is kept and uploaded into that account
 * (lib/local-owner-decision.ts's 'adopt'). The upload itself is the normal
 * "push every unsynced row" sweep (lib/background-sync/push-pending.ts) -
 * guest rows were never pushed, so they are all still unsynced.
 *
 * One thing has to happen first. The server allows one live category per
 * name per user, so a guest "Morning" category pushed into an account that
 * already has "Morning" would be rejected - and every task inside it with
 * it. So while the merge is pending:
 *   1. pushes are held back (lib/mutation-defaults.ts's pushChangesNow),
 *   2. the first signed-in sync pulls the account's data first, then
 *   3. folds each guest category into the account's same-named one
 *      (mergeGuestCategoriesIntoAccount), and only then pushes.
 */

const GUEST_MERGE_PENDING_KEY = 'soulshield_guest_merge_pending';

export async function markGuestMergePending(): Promise<void> {
  await AsyncStorage.setItem(GUEST_MERGE_PENDING_KEY, '1');
}

export async function isGuestMergePending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUEST_MERGE_PENDING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function clearGuestMergePending(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_MERGE_PENDING_KEY);
}

/** Re-points tasks from each never-synced (guest) category to the account's
 * category with the same name (case-insensitive, like the server's
 * add-to-my-tasks), then removes the guest category. It was never on the
 * server, so a plain local delete is enough - nothing to push for it.
 * Returns how many categories were merged. Call AFTER pulling the account's
 * data, BEFORE pushing. */
export function mergeGuestCategoriesIntoAccount(): number {
  const db = getLocalDb();
  if (!db) return 0;

  const live = db.select().from(categories).where(isNull(categories.deletedAt)).all();
  const plan = planGuestCategoryMerge(live);
  if (plan.size === 0) return 0;

  const now = new Date().toISOString();
  const client = (db as unknown as { $client: { withTransactionSync: (fn: () => void) => void } }).$client;
  client.withTransactionSync(() => {
    for (const [guestUuid, accountUuid] of plan) {
      db.update(tasks)
        .set({ categoryUuid: accountUuid, updatedAt: now, syncedAt: null })
        .where(eq(tasks.categoryUuid, guestUuid))
        .run();
      db.delete(categories).where(eq(categories.uuid, guestUuid)).run();
    }
  });
  return plan.size;
}
