import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export function PaginationBar({ page, totalPages, onPrev, onNext }: PaginationBarProps) {
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      <Pressable
        onPress={onPrev}
        disabled={!canGoPrev}
        hitSlop={8}
        style={styles.navButton}>
        <IconSymbol name="chevron.left" size={18} color={canGoPrev ? tint : mutedColor} />
        <ThemedText type="defaultSemiBold" style={{ color: canGoPrev ? tint : mutedColor }}>
          Previous
        </ThemedText>
      </Pressable>

      <ThemedText type="defaultSemiBold">
        Page {page} of {totalPages}
      </ThemedText>

      <Pressable
        onPress={onNext}
        disabled={!canGoNext}
        hitSlop={8}
        style={styles.navButton}>
        <ThemedText type="defaultSemiBold" style={{ color: canGoNext ? tint : mutedColor }}>
          Next
        </ThemedText>
        <IconSymbol name="chevron.right" size={18} color={canGoNext ? tint : mutedColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
});
