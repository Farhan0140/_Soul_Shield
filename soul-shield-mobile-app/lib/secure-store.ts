import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'soulshield_auth_token';
const REMEMBERED_EMAIL_KEY = 'soulshield_remembered_email';
const THEME_KEY = 'soulshield_theme';

export const tokenStore = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  removeToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
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
