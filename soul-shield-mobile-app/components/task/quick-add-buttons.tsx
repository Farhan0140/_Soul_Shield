import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

const AMOUNTS = [1, 5, 10];

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
        // TODO this button is for +{amount} (quick-add) on a counter type task/sub-task
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
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#8c8c8c',
  },
  label: { fontSize: 14, fontWeight: '700' },
});
