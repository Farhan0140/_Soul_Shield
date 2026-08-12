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

/** Registered with expo-font's useFonts in app/_layout.tsx — the family name
 * used to reference assets/fonts/KFGQPCUthmanTahaNaskh-Regular.ttf. */
export const ARABIC_FONT_FAMILY = 'KFGQPCUthmanTahaNaskh';
