import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const AMOUNTS = [5, 10];

interface QuickIncrementButtonsProps {
  onAdd: (amount: number) => void;
  onCustom: () => void;
  disabled?: boolean;
}

/** The dedicated page's secondary controls, below the main +1 button — +5,
 * +10, and a Custom amount trigger. Both fixed amounts call the exact same
 * increment path as the main button (see app/counter/[taskId].tsx); this
 * component adds no counting logic of its own. */
export function QuickIncrementButtons({ onAdd, onCustom, disabled }: QuickIncrementButtonsProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  return (
    <View style={styles.row}>
      {AMOUNTS.map((amount) => (
        <Pressable
          key={amount}
          disabled={disabled}
          onPress={() => onAdd(amount)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: card, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
          ]}>
          <ThemedText style={[styles.label, { color: tint }]}>+{amount}</ThemedText>
        </Pressable>
      ))}
      <Pressable
        disabled={disabled}
        onPress={onCustom}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: card, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}>
        <ThemedText style={[styles.label, { color: tint }]}>Custom</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  label: { fontSize: 16, fontWeight: '700' },
});
