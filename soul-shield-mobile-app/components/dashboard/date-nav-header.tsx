import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatDisplayDate, isToday } from '@/lib/date';

interface DateNavHeaderProps {
  date: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function DateNavHeader({ date, onPrev, onNext, onToday }: DateNavHeaderProps) {
  const tint = useThemeColor({}, 'tint');
  const showToday = !isToday(date);

  return (
    <View style={styles.container}>
      <ThemedText type="title">Today&apos;s Tasks</ThemedText>
      <View style={styles.row}>
        <Pressable onPress={onPrev} hitSlop={8} style={styles.arrow}>
          <IconSymbol name="chevron.left" size={20} color={tint} />
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.date}>
          {formatDisplayDate(date)}
        </ThemedText>
        <Pressable onPress={onNext} hitSlop={8} style={styles.arrow}>
          <IconSymbol name="chevron.right" size={20} color={tint} />
        </Pressable>
        {showToday ? (
          <Pressable onPress={onToday} hitSlop={8}>
            <ThemedText type="link" style={styles.today}>
              Today
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { padding: 4 },
  date: { flex: 1 },
  today: { fontSize: 14 },
});
