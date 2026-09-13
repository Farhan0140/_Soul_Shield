import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { ARABIC_FONT_OPTIONS, DEFAULT_ARABIC_FONT_ID } from '@/lib/arabic';
import { arabicFontStore } from '@/lib/secure-store';

const VALID_IDS = ARABIC_FONT_OPTIONS.map((option) => option.id);

interface ArabicFontContextValue {
  fontId: string;
  fontFamily: string;
  setFontId: (id: string) => void;
}

const ArabicFontContext = createContext<ArabicFontContextValue | null>(null);

/** Persists the user's Arabic-font choice (see profile/arabic-font-picker.tsx)
 * across app restarts and exposes it to every ThemedText for Arabic-script
 * rendering — same shape as theme-context.tsx's theme preference. */
export function ArabicFontProvider({ children }: { children: ReactNode }) {
  const [fontId, setFontIdState] = useState(DEFAULT_ARABIC_FONT_ID);

  useEffect(() => {
    arabicFontStore.get().then((saved) => {
      if (saved && VALID_IDS.includes(saved)) setFontIdState(saved);
    });
  }, []);

  const setFontId = (id: string) => {
    setFontIdState(id);
    arabicFontStore.set(id);
  };

  const fontFamily = useMemo(
    () => ARABIC_FONT_OPTIONS.find((option) => option.id === fontId)?.familyName ?? ARABIC_FONT_OPTIONS[0].familyName,
    [fontId]
  );

  const value = useMemo<ArabicFontContextValue>(
    () => ({ fontId, fontFamily, setFontId }),
    [fontId, fontFamily]
  );

  return <ArabicFontContext.Provider value={value}>{children}</ArabicFontContext.Provider>;
}

export function useArabicFont() {
  const ctx = useContext(ArabicFontContext);
  if (!ctx) throw new Error('useArabicFont must be used within an ArabicFontProvider');
  return ctx;
}
