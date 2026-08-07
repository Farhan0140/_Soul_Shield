import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, THEME_LABELS, type ThemeName } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';
import { useThemeColor } from '@/hooks/use-theme-color';

const THEME_OPTIONS = Object.keys(Colors) as ThemeName[];

export function ThemePicker() {
  const { preference, resolvedTheme, setPreference } = useAppTheme();
  const [open, setOpen] = useState(false);

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const insets = useSafeAreaInsets();

  const activePalette = Colors[resolvedTheme];
  const activeLabel = THEME_LABELS[resolvedTheme];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: cardColor, borderColor }]}>
        <View style={styles.triggerSwatchRow}>
          <View style={[styles.triggerSwatch, { backgroundColor: activePalette.background, borderColor: activePalette.border }]} />
          <View style={[styles.triggerSwatch, { backgroundColor: activePalette.tint }]} />
        </View>
        <ThemedText style={styles.triggerLabel}>{activeLabel}</ThemedText>
        <IconSymbol name="chevron.right" size={16} color={mutedColor} style={styles.chevron} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: cardColor, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.handle, { backgroundColor: borderColor }]} />
            <ThemedText type="subtitle" style={styles.title}>
              Choose Theme
            </ThemedText>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {THEME_OPTIONS.map((key) => {
                const palette = Colors[key];
                const isActive = preference === key;

                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setPreference(key);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
                    <View style={styles.swatchRow}>
                      <View
                        style={[styles.swatch, { backgroundColor: palette.background, borderColor: palette.border }]}
                      />
                      <View style={[styles.swatch, { backgroundColor: palette.tint }]} />
                      <View style={[styles.swatch, { backgroundColor: palette.success }]} />
                    </View>
                    <ThemedText style={styles.rowLabel}>{THEME_LABELS[key]}</ThemedText>
                    {isActive ? (
                      <IconSymbol name="checkmark.circle.fill" size={20} color={palette.tint} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  triggerSwatchRow: { flexDirection: 'row', gap: 6 },
  triggerSwatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  triggerLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
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
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { marginBottom: 6 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  swatchRow: { flexDirection: 'row', gap: 6 },
  swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});
