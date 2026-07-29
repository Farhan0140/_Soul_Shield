import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, type ThemeName } from '@/constants/theme';
import { useAppTheme } from '@/context/theme-context';

const THEME_OPTIONS: { key: ThemeName; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'brown', label: 'Brown' },
  { key: 'lemonGreen', label: 'Lemon Green' },
];

export function ThemePicker() {
  const { preference, setPreference } = useAppTheme();

  return (
    <View style={styles.grid}>
      {THEME_OPTIONS.map((option) => {
        const palette = Colors[option.key];
        const isActive = preference === option.key;

        return (
          <Pressable
            key={option.key}
            onPress={() => setPreference(option.key)}
            style={[
              styles.card,
              {
                backgroundColor: palette.card,
                borderColor: isActive ? palette.tint : palette.border,
                borderWidth: isActive ? 2 : 1,
              },
            ]}>
            {isActive ? (
              <View style={styles.checkBadge}>
                <IconSymbol name="checkmark.circle.fill" size={18} color={palette.tint} />
              </View>
            ) : null}
            <View style={styles.swatchRow}>
              <View
                style={[styles.swatch, { backgroundColor: palette.background, borderColor: palette.border }]}
              />
              <View style={[styles.swatch, { backgroundColor: palette.tint }]} />
              <View style={[styles.swatch, { backgroundColor: palette.success }]} />
            </View>
            <Text style={[styles.label, { color: palette.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 14,
    gap: 10,
  },
  checkBadge: { position: 'absolute', top: 10, right: 10 },
  swatchRow: { flexDirection: 'row', gap: 6 },
  swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  label: { fontSize: 14, fontWeight: '600' },
});
