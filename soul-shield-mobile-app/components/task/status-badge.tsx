import { StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

interface StatusBadgeProps {
  label: string;
  tone: 'neutral' | 'success' | 'danger';
}

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const muted = useThemeColor({}, 'muted');
  const card = useThemeColor({}, 'card');

  const color = tone === 'success' ? success : tone === 'danger' ? danger : muted;

  return (
    <View style={[styles.badge, { backgroundColor: card, borderColor: color }]}>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: { fontSize: 12, fontWeight: '600' },
});
