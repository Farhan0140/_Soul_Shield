import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useDailyVerseQuery } from '@/hooks/queries/use-daily-verse';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Small Home-screen widget showing today's verse (Arabic + English), from
 * the public quranapi.pages.dev content API — see lib/daily-verse.ts for how
 * "today's verse" is picked. Renders nothing while loading or on error
 * rather than a skeleton or error banner: this is a nice-to-have alongside
 * the actual task tracker, not core functionality, so a slow or unreachable
 * third-party API shouldn't visually compete with or block the rest of the
 * Home screen. The Arabic line goes through ThemedText's normal Arabic
 * auto-detection, so it already renders in whichever font the user picked
 * in Profile → Arabic Font. */
export function DailyVerseCard() {
  const { data: verse, isSuccess } = useDailyVerseQuery();
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  if (!isSuccess) return null;

  return (
    <View style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
      <View style={styles.header}>
        <IconSymbol name="sparkles" size={14} color={tintColor} />
        <ThemedText type="defaultSemiBold" style={[styles.label, { color: tintColor }]}>
          Verse of the Day
        </ThemedText>
      </View>
      <ThemedText style={styles.arabic}>{verse.arabic1}</ThemedText>
      <ThemedText style={styles.english}>{verse.english}</ThemedText>
      <ThemedText style={[styles.reference, { color: mutedColor }]}>
        {verse.surahName} {verse.surahNo}:{verse.ayahNo}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  arabic: { fontSize: 22, textAlign: 'right' },
  english: { fontSize: 15, fontStyle: 'italic' },
  reference: { fontSize: 12 },
});
