import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface RewardModalProps {
  visible: boolean;
  text: string;
  taskTitle?: string;
  onClose: () => void;
}

export function RewardModal({ visible, text, taskTitle, onClose }: RewardModalProps) {
  const cardColor = useThemeColor({}, 'card');
  const success = useThemeColor({}, 'success');
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={ZoomIn.springify().damping(14).mass(0.6)}
          style={[styles.card, { backgroundColor: cardColor }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeButton}>
            <IconSymbol name="xmark" size={20} color={mutedColor} />
          </Pressable>

          <View style={[styles.iconCircle, { backgroundColor: `${success}22` }]}>
            <IconSymbol name="sparkles" size={32} color={success} />
          </View>

          <ThemedText type="subtitle" style={styles.title}>
            Well done!
          </ThemedText>
          {taskTitle ? (
            <ThemedText style={[styles.taskTitle, { color: mutedColor }]} numberOfLines={1}>
              {taskTitle}
            </ThemedText>
          ) : null}
          <View style={[styles.textCard, { backgroundColor: `${success}14`, borderColor: `${success}33` }]}>
            <ThemedText selectable style={[styles.text, { color: success }]}>
              {text}
            </ThemedText>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: success, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ThemedText style={styles.ctaLabel}>Nice!</ThemedText>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 28,
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  taskTitle: { textAlign: 'center', fontSize: 13, marginTop: -8 },
  textCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  text: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  ctaButton: {
    width: '100%',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
