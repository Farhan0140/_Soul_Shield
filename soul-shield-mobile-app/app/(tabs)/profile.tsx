import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemePicker } from '@/components/profile/theme-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const cardColor = useThemeColor({}, 'card');
  const tintColor = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

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

      <PrimaryButton label="Log Out" variant="destructive" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 24 },
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
