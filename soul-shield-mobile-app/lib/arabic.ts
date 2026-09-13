/** Matches any character from the main Arabic Unicode blocks — Arabic
 * (U+0600–U+06FF), Arabic Supplement (U+0750–U+077F), Arabic Extended-A
 * (U+08A0–U+08FF), and Arabic Presentation Forms A/B (U+FB50–U+FDFF,
 * U+FE70–U+FEFF, used by ligated/joined rendering) — enough to reliably flag
 * "this string contains Arabic text" for font-switching purposes without
 * needing a full script-detection library. */
const ARABIC_SCRIPT_PATTERN =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function containsArabic(text: string): boolean {
  return ARABIC_SCRIPT_PATTERN.test(text);
}

export interface ArabicFontOption {
  /** Stable key persisted to disk (see lib/secure-store.ts) — independent of
   * familyName so the asset file backing an id can change without orphaning
   * a saved preference. */
  id: string;
  /** Family name registered with expo-font's useFonts in app/_layout.tsx. */
  familyName: string;
  /** Shown in the Arabic Font picker (profile/arabic-font-picker.tsx). */
  displayName: string;
  asset: number;
}

/** Every Arabic font bundled under assets/fonts, registered with expo-font
 * in app/_layout.tsx and selectable from the Profile screen (see
 * context/arabic-font-context.tsx + profile/arabic-font-picker.tsx). Adding
 * a font is just adding an entry here — nothing else needs to enumerate
 * them separately. */
export const ARABIC_FONT_OPTIONS: ArabicFontOption[] = [
  {
    id: 'indopak',
    familyName: 'IndopakNastaleeq',
    displayName: 'Indopak Nastaleeq',
    asset: require('@/assets/fonts/Indopak_Nastaleeq_font.ttf'),
  },
  {
    id: 'uthman-taha',
    familyName: 'UthmanTahaNaskh',
    displayName: 'Uthman Taha Naskh',
    asset: require('@/assets/fonts/KFGQPCUthmanTahaNaskh-Regular.ttf'),
  },
  {
    id: 'me-quran',
    familyName: 'MeQuran',
    displayName: 'Me Quran',
    asset: require('@/assets/fonts/me_quran Regular.ttf'),
  },
  {
    id: 'noore-hidayat',
    familyName: 'NooreHidayat',
    displayName: 'Noore Hidayat',
    asset: require('@/assets/fonts/noorehidayat Regular.ttf'),
  },
];

export const DEFAULT_ARABIC_FONT_ID = ARABIC_FONT_OPTIONS[0].id;

/** Sample line (Al-Fatiha 1:1) shown next to each option in the picker so
 * switching fonts is a visual choice, not a guess from the name alone. */
export const ARABIC_FONT_DEMO_TEXT = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
