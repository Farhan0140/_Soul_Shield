import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ReorderRowProps {
  title: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** A row for the dedicated Reorder pages (app/reorder/*): an up arrow, the
 * item's title, and a down arrow. Moving is an explicit tap that swaps this
 * row with its neighbor - no drag gesture to misfire, and the result is
 * always exactly one swap per tap. */
export function ReorderRow({ title, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: ReorderRowProps) {
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={[styles.row, { backgroundColor: cardColor, borderColor }]}>
      <ArrowButton
        icon="chevron.up"
        onPress={onMoveUp}
        disabled={!canMoveUp}
        tintColor={tintColor}
        mutedColor={mutedColor}
      />
      <ThemedText type="defaultSemiBold" style={styles.title} numberOfLines={2}>
        {title}
      </ThemedText>
      <ArrowButton
        icon="chevron.down"
        onPress={onMoveDown}
        disabled={!canMoveDown}
        tintColor={tintColor}
        mutedColor={mutedColor}
      />
    </View>
  );
}

function ArrowButton({
  icon,
  onPress,
  disabled,
  tintColor,
  mutedColor,
}: {
  icon: 'chevron.up' | 'chevron.down';
  onPress: () => void;
  disabled: boolean;
  tintColor: string;
  mutedColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.arrowCircle,
        { backgroundColor: `${(disabled ? mutedColor : tintColor)}1A`, opacity: pressed ? 0.6 : 1 },
      ]}>
      <IconSymbol name={icon} size={22} color={disabled ? mutedColor : tintColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  title: { flex: 1, textAlign: 'center' },
  arrowCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
