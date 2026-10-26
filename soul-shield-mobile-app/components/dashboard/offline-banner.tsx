import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Slim "offline" strip shown at the top of Home while the device has no
 * connection. The whole app keeps working offline (local-first — see
 * PROJECT_CONTEXT.md §8); this makes that visible instead of surprising,
 * and reassures the user their edits won't be lost. */
export function OfflineBanner() {
  const { t } = useLocale();
  const dangerColor = useThemeColor({}, 'danger');
  const missedTint = useThemeColor({}, 'missedTint');

  return (
    <View style={[styles.banner, { backgroundColor: missedTint }]}>
      <IconSymbol name="iphone.radiowaves.left.and.right" size={14} color={dangerColor} />
      <ThemedText style={[styles.text, { color: dangerColor }]}>{t('home.offlineBanner')}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  text: { fontSize: 12 },
});
