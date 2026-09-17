/** SQLite has no native array column type - recurrence_days (see
 * lib/db/schema.ts) is stored as a JSON-encoded string and converted at the
 * repo boundary, so nothing above lib/db/ ever deals with the encoding. */
export function encodeIntArray(values: number[]): string {
  return JSON.stringify(values);
}

export function decodeIntArray(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is number => typeof v === 'number') : [];
  } catch {
    return [];
  }
}
