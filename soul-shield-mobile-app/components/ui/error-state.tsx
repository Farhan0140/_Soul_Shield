import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const dangerColor = useThemeColor({}, 'danger');
  const missedTint = useThemeColor({}, 'missedTint');

  return (
    <View style={[styles.container, { backgroundColor: missedTint }]}>
      <IconSymbol name="exclamationmark.triangle.fill" size={22} color={dangerColor} />
      <ThemedText selectable style={[styles.message, { color: dangerColor }]}>
        {message}
      </ThemedText>
      {onRetry ? <PrimaryButton label="Retry" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, borderRadius: 14, borderCurve: 'continuous' },
  message: { fontSize: 14 },
});
