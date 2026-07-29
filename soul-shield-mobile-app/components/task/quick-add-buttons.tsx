import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

const AMOUNTS = [1, 10, 50];

interface QuickAddButtonsProps {
  onAdd: (amount: number) => void;
  disabled?: boolean;
}

export function QuickAddButtons({ onAdd, disabled }: QuickAddButtonsProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');

  return (
    <View style={styles.row}>
      {AMOUNTS.map((amount) => (
        <Pressable
          key={amount}
          disabled={disabled}
          onPress={() => onAdd(amount)}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: card, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
          ]}>
          <Text style={[styles.label, { color: tint }]}>+{amount}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  label: { fontSize: 14, fontWeight: '700' },
});
