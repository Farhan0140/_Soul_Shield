// Client-side mirrors of the server's input rules (soul-shield/util/validate.go
// and util.ValidateNewPassword), so users see the problem before a round-trip.
// The server stays the source of truth.

export const NAME_MAX = 100;
export const EMAIL_MAX = 255;
export const PASSWORD_MIN = 6;
/** bcrypt ignores everything past 72 bytes, so the server refuses longer. */
export const PASSWORD_MAX_BYTES = 72;

// local@domain.tld, no spaces, a dot in the domain.
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function utf8Length(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Each returns an error message, or null when the value is valid. */
export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Please enter your name.';
  if ([...trimmed].length > NAME_MAX) return `Your name can be at most ${NAME_MAX} characters.`;
  return null;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Please enter your email.';
  if (trimmed.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmed)) return "That doesn't look like a valid email.";
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Your password needs at least ${PASSWORD_MIN} characters.`;
  if (utf8Length(password) > PASSWORD_MAX_BYTES) return 'Your password is too long (72 characters at most).';
  return null;
}
