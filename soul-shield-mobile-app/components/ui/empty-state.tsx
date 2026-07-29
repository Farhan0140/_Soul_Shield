import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useThemeColor } from '@/hooks/use-theme-color';

interface EmptyStateProps {
  icon?: IconSymbolName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'tray', title, message, actionLabel, onAction }: EmptyStateProps) {
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={styles.container}>
      <IconSymbol name={icon} size={40} color={mutedColor} />
      <ThemedText type="defaultSemiBold" style={styles.title}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText style={[styles.message, { color: mutedColor }]}>{message}</ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24 },
  title: { textAlign: 'center' },
  message: { textAlign: 'center' },
  action: { marginTop: 8, alignSelf: 'stretch' },
});
