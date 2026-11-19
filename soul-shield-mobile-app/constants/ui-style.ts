import { Caveat_700Bold } from '@expo-google-fonts/caveat/700Bold';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand/400Regular';

import type { I18nKey } from '@/lib/i18n';
import type { UIStyleName } from '@/lib/ui-style/palette';

export { DEFAULT_UI_STYLE, UI_STYLES, isUIStyleName, type UIStyleName } from '@/lib/ui-style/palette';

/** Handwritten families used by the Paper and Pencil styles — the same pair
 * both reference designs use: Patrick Hand for body/UI text, Caveat for
 * headings. Registered with expo-font in app/_layout.tsx. Each family ships
 * one weight per name, so text in these families always renders with
 * fontWeight 'normal' (Android drops a custom font for the system font when
 * asked for a weight the family has no face for — see ThemedText). */
export const HAND_FONTS = {
  body: 'PatrickHand_400Regular',
  heading: 'Caveat_700Bold',
} as const;

export const HAND_FONT_ASSETS = {
  [HAND_FONTS.body]: PatrickHand_400Regular,
  [HAND_FONTS.heading]: Caveat_700Bold,
};

export const UI_STYLE_LABEL_KEYS: Record<UIStyleName, { label: I18nKey; hint: I18nKey }> = {
  normal: { label: 'profile.uiStyle.normal', hint: 'profile.uiStyle.normalHint' },
  paper: { label: 'profile.uiStyle.paper', hint: 'profile.uiStyle.paperHint' },
  pencil: { label: 'profile.uiStyle.pencil', hint: 'profile.uiStyle.pencilHint' },
};
