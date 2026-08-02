import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemePicker } from '@/components/profile/theme-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { clearOfflineCache, countPendingMutations } from '@/lib/persister';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const [clearing, setClearing] = useState(false);

  const handleClearCache = () => {
    const pending = countPendingMutations(queryClient);
    const message =
      pending > 0
        ? `You have ${pending} offline change${pending === 1 ? '' : 's'} that haven't synced yet. Clearing offline data will discard ${pending === 1 ? 'it' : 'them'} instead of sending it. This can't be undone. Continue?`
        : "This clears everything saved on this device for offline use. It'll be re-downloaded next time you're online. This can't be undone. Continue?";

    Alert.alert('Clear Offline Data', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await clearOfflineCache(queryClient);
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: cardColor }]}>
        <IconSymbol name="person.crop.circle.fill" size={56} color={tintColor} />
        <View style={styles.info}>
          <ThemedText type="subtitle">{user?.full_name}</ThemedText>
          <ThemedText>{user?.email}</ThemedText>
          {user?.role === 'admin' ? <ThemedText type="defaultSemiBold">Admin</ThemedText> : null}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="paintpalette.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Appearance
          </ThemedText>
        </View>
        <ThemePicker />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="externaldrive.fill" size={16} color={mutedColor} />
          <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
            Data
          </ThemedText>
        </View>
        <PrimaryButton
          label="Clear Offline Data"
          variant="secondary"
          loading={clearing}
          onPress={handleClearCache}
        />
      </View>

      <PrimaryButton label="Log Out" variant="destructive" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingBottom: 120, gap: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  info: { gap: 4 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
});
