import * as SecureStore from 'expo-secure-store';

import type { User } from '@/api/types';

const TOKEN_KEY = 'soulshield_auth_token';
const REMEMBERED_EMAIL_KEY = 'soulshield_remembered_email';
const THEME_KEY = 'soulshield_theme';
const CACHED_USER_KEY = 'soulshield_cached_user';

export const tokenStore = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  removeToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

/** Last-known signed-in user profile, kept alongside the token so the app can
 * open straight into a signed-in state when there's no network to revalidate
 * against (see context/auth-context.tsx). */
export const cachedUserStore = {
  get: async (): Promise<User | null> => {
    const raw = await SecureStore.getItemAsync(CACHED_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  set: (user: User) => SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user)),
  clear: () => SecureStore.deleteItemAsync(CACHED_USER_KEY),
};

export const rememberedEmailStore = {
  get: () => SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY),
  set: (email: string) => SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email),
  clear: () => SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY),
};

export const themePreferenceStore = {
  get: () => SecureStore.getItemAsync(THEME_KEY),
  set: (theme: string) => SecureStore.setItemAsync(THEME_KEY, theme),
};
