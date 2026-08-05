import type { Category, Task, User } from '@/api/types';

/** Thrown instead of letting a malformed response silently corrupt the local
 * cache — the sync runner catches this the same as a network/HTTP failure
 * and aborts the whole write (see sync.ts), so a partial/garbled payload
 * never gets merged in. */
export class ValidationError extends Error {
  constructor(what: string) {
    super(`Invalid API response: ${what}`);
    this.name = 'ValidationError';
  }
}

export function assertTaskArray(data: unknown, from: string): Task[] {
  if (!Array.isArray(data)) throw new ValidationError(`${from} did not return an array`);
  for (const item of data) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Task).task_id !== 'number' ||
      typeof (item as Task).title !== 'string' ||
      typeof (item as Task).date !== 'string'
    ) {
      throw new ValidationError(`${from} contained a malformed task`);
    }
  }
  return data as Task[];
}

export function assertCategoryArray(data: unknown): Category[] {
  if (!Array.isArray(data)) throw new ValidationError('categories did not return an array');
  for (const item of data) {
    if (typeof item !== 'object' || item === null || typeof (item as Category).id !== 'number') {
      throw new ValidationError('categories contained a malformed entry');
    }
  }
  return data as Category[];
}

export function assertUser(data: unknown): User {
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as User).id !== 'number' ||
    typeof (data as User).email !== 'string'
  ) {
    throw new ValidationError('user profile response was malformed');
  }
  return data as User;
}
