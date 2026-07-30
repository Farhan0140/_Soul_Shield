import { apiGet, apiPost } from '@/api/client';
import type { User } from '@/api/types';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

/**
 * Backend docs say "201: JWT token string" but don't pin down whether the body is a bare
 * JSON string or `{ token }`. Handle both until this is confirmed against the running backend.
 */
function extractToken(response: unknown): string {
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object') {
    const token = (response as Record<string, unknown>).token ?? (response as Record<string, unknown>).access_token;
    if (typeof token === 'string') return token;
  }
  throw new Error('Unexpected login response shape');
}

export async function login(input: LoginInput): Promise<string> {
  const response = await apiPost<unknown>('/users/login', input);
  return extractToken(response);
}

export function register(input: RegisterInput) {
  return apiPost<{ id: number; full_name: string; email: string }>('/users/register', {
    full_name: input.name,
    email: input.email,
    password: input.password,
  });
}

export function fetchMe(token: string) {
  return apiGet<User>('/users/me', token);
}

export function resetPassword(email: string, newPassword: string) {
  return apiPost<void>('/users/reset-password', { email, new_password: newPassword });
}
