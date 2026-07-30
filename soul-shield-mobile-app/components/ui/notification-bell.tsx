import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSyncNotifications } from '@/context/sync-notifications-context';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Badge + icon surfacing genuinely failed sync mutations (not offline-paused
 * ones, which retry silently). Pinned to the opposite corner from `Fab` so
 * the two absolutely-positioned overlays never collide. */
export function NotificationBell() {
  const { unreadCount } = useSyncNotifications();
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  const card = useThemeColor({}, 'card');
  const insets = useSafeAreaInsets();

  if (unreadCount === 0) return null;

  return (
    <Pressable
      onPress={() => router.push('/sync-notifications')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.bell,
        { top: insets.top + 12, backgroundColor: card, opacity: pressed ? 0.85 : 1 },
      ]}>
      <IconSymbol name="bell.fill" size={22} color={tint} />
      <View style={[styles.badge, { backgroundColor: danger }]}>
        <Text style={styles.badgeLabel}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 5 },
    }),
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
