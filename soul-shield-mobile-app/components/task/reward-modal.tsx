import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Keyframe, ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { hapticSuccess } from '@/lib/feedback';

interface RewardModalProps {
  visible: boolean;
  text: string;
  taskTitle?: string;
  onClose: () => void;
}

const CONFETTI_COUNT = 16;

/** One confetti piece: deterministic pseudo-random geometry/rotation per
 * index (so every open bursts the same pretty spread — no flip-flopping on
 * re-render), falling past the card with a Keyframe entering animation.
 * All Reanimated keyframes are constructed at module scope per (index, seed)
 * via this factory, never inline per render. */
function confettiEntering(index: number, seed: number) {
  const rand = (salt: number) => {
    const x = Math.sin((index + 1) * 12.9898 + seed * 78.233 + salt * 3.7) * 43758.5453;
    return x - Math.floor(x); // 0..1
  };
  const delay = Math.round(rand(1) * 260);
  const duration = 1300 + Math.round(rand(2) * 700);
  const spin = Math.round(360 + rand(3) * 540);
  const startOffset = Math.round(-30 + rand(4) * 30);
  return new Keyframe({
    0: {
      transform: [{ translateY: startOffset }, { rotate: '0deg' }],
      opacity: 1,
    },
    80: { opacity: 1 },
    100: {
      transform: [{ translateY: 420 }, { rotate: `${spin}deg` }],
      opacity: 0,
    },
  })
    .duration(duration)
    .delay(delay);
}

/** Celebration overlay pieces — rendered only while a burst is active (see
 * key in RewardModal), contained to the confetti layer so they clean up. */
function ConfettiBurst({ seed, colors }: { seed: number; colors: string[] }) {
  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {Array.from({ length: CONFETTI_COUNT }, (_, index) => {
        const left = 4 + ((index * 137 + seed * 7) % 92);
        const size = 5 + ((index * 7 + seed) % 6);
        const color = colors[index % colors.length];
        return (
          <AnimatedPiece
            key={`${seed}-${index}`}
            index={index}
            seed={seed}
            color={color}
            left={left}
            size={size}
          />
        );
      })}
    </View>
  );
}

function AnimatedPiece({
  index,
  seed,
  color,
  left,
  size,
}: {
  index: number;
  seed: number;
  color: string;
  left: number;
  size: number;
}) {
  return (
    <Animated.View
      entering={confettiEntering(index, seed)}
      style={[styles.piece, { left: `${left}%`, backgroundColor: color, width: size, height: size * 0.45 }]}
    />
  );
}

export function RewardModal({ visible, text, taskTitle, onClose }: RewardModalProps) {
  const cardColor = useThemeColor({}, 'card');
  const success = useThemeColor({}, 'success');
  const tint = useThemeColor({}, 'tint');
  const warning = useThemeColor({}, 'warning');
  const mutedColor = useThemeColor({}, 'muted');
  // Bumps each time the modal opens so a fresh confetti burst (new keys) and
  // haptic fire on every reward, not just the first.
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setBurstKey((k) => k + 1);
    hapticSuccess();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          entering={ZoomIn.springify().damping(14).mass(0.6)}
          style={[styles.card, { backgroundColor: cardColor }]}>
          {burstKey > 0 ? (
            <ConfettiBurst key={burstKey} seed={burstKey} colors={[success, tint, warning]} />
          ) : null}

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
    overflow: 'hidden',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-start',
  },
  piece: {
    position: 'absolute',
    top: 40,
    borderRadius: 2,
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
    zIndex: 1,
  },
  text: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  ctaButton: {
    width: '100%',
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    zIndex: 1,
  },
  ctaLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
