import { randomUUID } from 'expo-crypto';

/** Client-generated identity for every locally-created row (tasks,
 * categories, sub-tasks, completions) - see lib/db/schema.ts. Thin wrapper
 * so nothing outside lib/db/ needs to import expo-crypto directly. */
export function newUuid(): string {
  return randomUUID();
}
