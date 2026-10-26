import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { translate, type I18nKey, type Locale } from '@/lib/i18n';

export type { Locale };

const LOCALE_KEY = 'soulshield_locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a key in the active locale (falls back to English). */
  t: (key: I18nKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  // Render nothing until the stored preference is known, so the very first
  // paint never flashes English for a Bengali user (same pattern as the
  // auth-loading gate in app/_layout.tsx).
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_KEY)
      .then((raw) => {
        if (raw === 'en' || raw === 'bn') setLocaleState(raw);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(LOCALE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback((key: I18nKey) => translate(locale, key), [locale]);

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  if (!loaded) return null;

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
