import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PencilOutline, ThemeDecor } from '@/components/ui/theme-decor';
import { Colors, ThemeScheme } from '@/constants/theme';
import { HAND_FONTS, UI_STYLE_LABEL_KEYS, UI_STYLES, type UIStyleName } from '@/constants/ui-style';
import { useAppTheme } from '@/context/theme-context';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';
import { adaptPalette, buildStyleTokens } from '@/lib/ui-style/palette';

/** Profile → Theme: picks the visual UI style (Normal / Paper / Pencil).
 * Independent of the color palette (Appearance) and the Arabic font — both
 * keep working, and keep their values, under every style. Same trigger +
 * bottom-sheet pattern as ThemePicker. */
export function UIStylePicker() {
  const { uiStyle, setUIStyle } = useAppTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const surface = useSurface();

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const tintColor = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('profile.uiStyle.choose')}
        style={[styles.trigger, { backgroundColor: cardColor, borderColor }, surface('card')]}>
        <ThemeDecor kind="card" />
        <StylePreview styleName={uiStyle} small />
        <View style={styles.triggerText}>
          <ThemedText style={styles.triggerLabel}>{t(UI_STYLE_LABEL_KEYS[uiStyle].label)}</ThemedText>
          <ThemedText style={[styles.triggerHint, { color: mutedColor }]}>
            {t(UI_STYLE_LABEL_KEYS[uiStyle].hint)}
          </ThemedText>
        </View>
        <IconSymbol name="chevron.right" size={16} color={mutedColor} style={styles.chevron} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: cardColor, paddingBottom: insets.bottom + 20 }, surface('sheet')]}>
            <ThemeDecor kind="sheet" />
            <View style={[styles.handle, { backgroundColor: borderColor }]} />
            <ThemedText type="subtitle" style={styles.title}>
              {t('profile.uiStyle.choose')}
            </ThemedText>
            {UI_STYLES.map((key) => {
              const isActive = uiStyle === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    setUIStyle(key);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
                  <StylePreview styleName={key} />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowLabel}>{t(UI_STYLE_LABEL_KEYS[key].label)}</ThemedText>
                    <ThemedText style={[styles.rowHint, { color: mutedColor }]}>
                      {t(UI_STYLE_LABEL_KEYS[key].hint)}
                    </ThemedText>
                  </View>
                  {isActive ? <IconSymbol name="checkmark.circle.fill" size={22} color={tintColor} /> : null}
                </Pressable>
              );
            })}
            <ThemedText style={[styles.note, { color: mutedColor }]}>{t('profile.uiStyle.colorsNote')}</ThemedText>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** A tiny static mock-up of a card + button drawn in `styleName`, using the
 * currently selected color palette — so each option shows exactly how the
 * user's own colors will look in it. */
function StylePreview({ styleName, small }: { styleName: UIStyleName; small?: boolean }) {
  const { resolvedTheme } = useAppTheme();
  const scheme = ThemeScheme[resolvedTheme];
  const p = adaptPalette(Colors[resolvedTheme], scheme, styleName);
  const tk = buildStyleTokens(p, scheme, styleName);
  const w = small ? 56 : 72;
  const h = small ? 44 : 56;
  const font = styleName === 'normal' ? undefined : { fontFamily: HAND_FONTS.heading, fontWeight: 'normal' as const };

  return (
    <View
      style={[
        styles.preview,
        { width: w, height: h, backgroundColor: p.background, borderColor: styleName === 'normal' ? p.border : tk.ink },
        styleName === 'paper' && styles.previewPaper,
        styleName === 'pencil' && styles.previewPencil,
      ]}>
      {styleName === 'paper' ? (
        <>
          {[0.33, 0.66].map((y) => (
            <View key={y} style={[styles.rule, { top: h * y, backgroundColor: tk.ruleLine }]} />
          ))}
          <View style={[styles.previewNote, { backgroundColor: p.card, boxShadow: `2px 2px 0px ${tk.noteDeep}` }]}>
            <View style={[styles.previewTape, { backgroundColor: tk.tape }]} />
          </View>
        </>
      ) : null}
      {styleName === 'pencil' ? (
        <>
          <PencilOutline kind="card" radius={3} stroke={tk.ink} />
          <View style={styles.previewCard}>
            <PencilOutline kind="card" radius={2} stroke={tk.ink} hatch={tk.hatch} hatchSpacing={4} hatchWidth={1} />
          </View>
        </>
      ) : null}
      {styleName === 'normal' ? <View style={[styles.previewCard, { backgroundColor: p.card }]} /> : null}
      <Text style={[styles.previewGlyph, { color: p.text }, font, !font && styles.previewGlyphNormal]}>Aa</Text>
      <View
        style={[
          styles.previewButton,
          { backgroundColor: p.tint },
          styleName === 'paper' && { borderWidth: 1.5, borderColor: tk.ink, borderRadius: 3 },
          styleName === 'pencil' && styles.previewButtonPencil,
        ]}>
        {styleName === 'pencil' ? (
          <PencilOutline kind="button" radius={3} stroke={tk.ink} hatch={p.tint} hatchSpacing={4} hatchWidth={1.2} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  triggerText: { flex: 1, gap: 2 },
  triggerLabel: { fontSize: 15, fontWeight: '600' },
  triggerHint: { fontSize: 12, lineHeight: 16 },
  chevron: { transform: [{ rotate: '90deg' }] },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    padding: 20,
    gap: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowHint: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 12, marginTop: 8 },
  preview: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 6,
  },
  previewPaper: { borderRadius: 4, borderBottomRightRadius: 12, borderWidth: 1.5 },
  previewPencil: { borderWidth: 0, borderRadius: 6 },
  rule: { position: 'absolute', left: 0, right: 0, height: 1 },
  previewNote: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: '40%',
    height: '45%',
    borderBottomRightRadius: 6,
    transform: [{ rotate: '4deg' }],
  },
  previewTape: { position: 'absolute', top: -3, left: '25%', width: '50%', height: 5 },
  previewCard: { position: 'absolute', right: 6, top: 6, width: '40%', height: '45%', borderRadius: 5 },
  previewGlyph: { fontSize: 18, lineHeight: 20 },
  previewGlyphNormal: { fontSize: 14, fontWeight: '700' },
  previewButton: { height: 9, width: '60%', borderRadius: 5, overflow: 'hidden' },
  previewButtonPencil: { height: 12, borderRadius: 3, backgroundColor: 'transparent', overflow: 'visible' },
});
