// Pure (no Expo imports) so tests/ can run it under plain Node.

/** Pulls the `type` out of a data-only push, whichever shape it arrives in.
 * expo-notifications 0.32 hands the task `{ data: { dataString } }` (Android
 * FCM: the Expo push `data` as a JSON string), while iOS puts the custom keys
 * at the top level of `data` (or under `body`). Exported for unit tests. */
export function dataChangeType(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  if ('actionIdentifier' in payload) return undefined; // a tap on a notification, not a data push

  const data = (payload as { data?: Record<string, unknown> }).data;
  if (!data || typeof data !== 'object') return undefined;

  const candidates: unknown[] = [data, data.body];
  if (typeof data.dataString === 'string') {
    try {
      candidates.unshift(JSON.parse(data.dataString));
    } catch {
      // not JSON: ignore
    }
  }
  if (typeof data.body === 'string') {
    try {
      candidates.push(JSON.parse(data.body));
    } catch {
      // not JSON: ignore
    }
  }
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      const type = (candidate as { type?: unknown }).type;
      if (typeof type === 'string') return type;
    }
  }
  return undefined;
}
