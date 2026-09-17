import type { User } from '@/api/types';

/** Thrown instead of letting a malformed response silently corrupt the local
 * cache — the sync runner catches this the same as a network/HTTP failure
 * and aborts the whole sync (see sync.ts), so a partial/garbled payload
 * never gets merged in. */
export class ValidationError extends Error {
  constructor(what: string) {
    super(`Invalid API response: ${what}`);
    this.name = 'ValidationError';
  }
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
