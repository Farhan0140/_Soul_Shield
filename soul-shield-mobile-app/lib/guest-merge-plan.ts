/** Pure decision logic for lib/guest-merge.ts, kept free of imports so it can
 * be unit-tested directly under Node (tests/guest-merge-plan.test.mjs). */

export interface MergeCandidate {
  uuid: string;
  name: string;
  /** null = never seen by the server (made on this device, e.g. as a guest). */
  serverUpdatedAt: string | null;
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Which never-synced (guest) categories fold into an account category with
 * the same name (case-insensitive, like the server's add-to-my-tasks).
 * Returns guest uuid -> account uuid. Pass live (not deleted) categories. */
export function planGuestCategoryMerge(candidates: MergeCandidate[]): Map<string, string> {
  const accountByName = new Map<string, string>();
  for (const c of candidates) {
    if (c.serverUpdatedAt !== null) accountByName.set(nameKey(c.name), c.uuid);
  }

  const plan = new Map<string, string>();
  for (const c of candidates) {
    if (c.serverUpdatedAt !== null) continue; // already the server's
    const target = accountByName.get(nameKey(c.name));
    if (target && target !== c.uuid) plan.set(c.uuid, target);
  }
  return plan;
}
