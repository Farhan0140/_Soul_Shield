import { Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFab } from '@/context/fab-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';

/** Floating "+" button anchored above the tab bar. Each tab screen registers
 * its own create action via `useFabAction`; the button hides itself when the
 * focused screen hasn't registered one. */
export function Fab() {
  const { action } = useFab();
  const tint = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();

  if (!action) return null;

  return (
    <Pressable
      onPress={action}
      hitSlop={8}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: tint, bottom: insets.bottom + 72, opacity: pressed ? 0.85 : 1 },
      ]}>
      <IconSymbol name="plus" size={26} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
      },
      android: { elevation: 6 },
    }),
  },
});
