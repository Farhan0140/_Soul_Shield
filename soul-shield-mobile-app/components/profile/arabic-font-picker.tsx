import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useArabicFont } from '@/context/arabic-font-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ARABIC_FONT_DEMO_TEXT, ARABIC_FONT_OPTIONS } from '@/lib/arabic';

/** Same trigger + bottom-sheet shape as profile/theme-picker.tsx. Each row
 * renders the shared demo sentence in that row's own font, not just its
 * name, so picking a font is a visual comparison rather than a guess. */
export function ArabicFontPicker() {
  const { fontId, setFontId } = useArabicFont();
  const [open, setOpen] = useState(false);

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();

  const activeOption = ARABIC_FONT_OPTIONS.find((option) => option.id === fontId) ?? ARABIC_FONT_OPTIONS[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: cardColor, borderColor }]}>
        <View style={styles.triggerInfo}>
          <ThemedText style={styles.triggerLabel}>{activeOption.displayName}</ThemedText>
          <Text style={[styles.triggerDemo, { color: mutedColor, fontFamily: activeOption.familyName }]}>
            {ARABIC_FONT_DEMO_TEXT}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={mutedColor} style={styles.chevron} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: cardColor, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.handle, { backgroundColor: borderColor }]} />
            <ThemedText type="subtitle" style={styles.title}>
              Choose Arabic Font
            </ThemedText>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {ARABIC_FONT_OPTIONS.map((option) => {
                const isActive = option.id === fontId;

                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      setFontId(option.id);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.row,
                      { borderColor: isActive ? tintColor : borderColor, opacity: pressed ? 0.7 : 1 },
                    ]}>
                    <View style={styles.rowInfo}>
                      <ThemedText type="defaultSemiBold" style={styles.rowLabel}>
                        {option.displayName}
                      </ThemedText>
                      <Text
                        style={[styles.rowDemo, { color: textColor, fontFamily: option.familyName }]}
                        numberOfLines={1}>
                        {ARABIC_FONT_DEMO_TEXT}
                      </Text>
                    </View>
                    {isActive ? (
                      <IconSymbol name="checkmark.circle.fill" size={20} color={tintColor} />
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
  triggerInfo: { flex: 1, gap: 4 },
  triggerLabel: { fontSize: 15, fontWeight: '600' },
  triggerDemo: { fontSize: 20, textAlign: 'right' },
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
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    marginBottom: 10,
  },
  rowInfo: { flex: 1, gap: 6 },
  rowLabel: { fontSize: 15 },
  rowDemo: { fontSize: 22, textAlign: 'right' },
});
