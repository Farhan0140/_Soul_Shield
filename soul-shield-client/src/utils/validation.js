// Client-side mirrors of the server's input rules (soul-shield/util/validate.go
// and util.ValidateNewPassword), so users see the problem before submitting.
// The server stays the source of truth.

export const NAME_MAX = 100;
export const EMAIL_MAX = 255;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes

// local@domain.tld, no spaces, a dot in the domain.
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const byteLength = (s) => new TextEncoder().encode(s).length;

/** Returns an error message, or '' when valid. */
export function validateFullName(name) {
  const trimmed = name.trim();
  if (!trimmed) return 'What should we call you?';
  if ([...trimmed].length > NAME_MAX) return `Keep your name under ${NAME_MAX} characters.`;
  return '';
}

export function validateEmail(email) {
  const trimmed = email.trim();
  if (!trimmed) return 'We need your email to continue.';
  if (trimmed.length > EMAIL_MAX || !EMAIL_PATTERN.test(trimmed)) return "That doesn't look like a valid email.";
  return '';
}

export function validateNewPassword(password) {
  if (!password) return 'Please choose a password.';
  if (password.length < PASSWORD_MIN) return `At least ${PASSWORD_MIN} characters — keep it safe.`;
  if (byteLength(password) > PASSWORD_MAX_BYTES) return 'That password is too long (72 characters at most).';
  return '';
}
