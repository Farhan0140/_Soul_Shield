import { ApiError } from '@/lib/errors';

// Separate from api/client.ts on purpose: this hits the public, unauthenticated
// quranapi.pages.dev content API, not our own backend — no token, no
// EXPO_PUBLIC_API_URL, and no JSON request body ever leaves this client.
const BASE_URL = 'https://quranapi.pages.dev/api';

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`);
  } catch {
    throw new ApiError('Network error', 0, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (${response.status})`, response.status);
  }

  return response.json();
}

export const quranApiGet = <T,>(path: string) => request<T>(path);
