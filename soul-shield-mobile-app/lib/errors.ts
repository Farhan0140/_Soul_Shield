export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export type ErrorContext = 'login' | 'register' | 'reset-password';

// Backend messages are written for logs, not users (e.g. "Internal Server Error" for a
// wrong password). Per-screen overrides translate known status codes into copy someone
// can actually act on; the generic switch below is the fallback for everything else.
const CONTEXT_MESSAGES: Record<ErrorContext, Partial<Record<number, string>>> = {
  login: {
    400: 'Incorrect email or password.',
    401: 'Incorrect email or password.',
    404: 'Incorrect email or password.',
  },
  register: {
    409: 'That email is already registered — try logging in instead.',
  },
  'reset-password': {
    400: "We couldn't find an account with that email.",
    404: "We couldn't find an account with that email.",
  },
};

export function getErrorMessage(error: unknown, context?: ErrorContext): string {
  if (error instanceof ApiError) {
    const override = context && CONTEXT_MESSAGES[context][error.status];
    if (override) return override;

    switch (error.status) {
      case 400:
        return error.message || 'That request was invalid.';
      case 401:
        return 'Your session has expired. Please log in again.';
      case 403:
        return "You don't have permission to do that.";
      case 404:
        return "That couldn't be found.";
      case 409:
        return error.message || 'That already exists.';
      case 0:
        return 'Network error — check your connection and try again.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
