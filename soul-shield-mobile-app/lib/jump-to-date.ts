/** Cross-tab "jump to date" hand-off: the History screen's heatmap (and the
 * Search screen, and the Insights screen) can ask Home to select a specific
 * date. A module-level one-shot beats route params — the Home screen's `date`
 * is local state and tabs don't re-mount on navigation, so params would be
 * silently dropped. Consumed by app/(tabs)/index.tsx in its useFocusEffect. */
let pendingJump: string | null = null;

export function setJumpToDate(iso: string): void {
  pendingJump = iso;
}

/** Returns the pending date (if any) and clears it. */
export function consumeJumpToDate(): string | null {
  const value = pendingJump;
  pendingJump = null;
  return value;
}
