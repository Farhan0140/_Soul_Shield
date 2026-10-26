import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';

const ONBOARDING_KEY = 'soulshield_onboarding_done_v1';

const SLIDES: { icon: Parameters<typeof IconSymbol>[0]['name']; titleKey: 'onb.s1.title' | 'onb.s2.title' | 'onb.s3.title'; bodyKey: 'onb.s1.body' | 'onb.s2.body' | 'onb.s3.body' }[] = [
  { icon: 'externaldrive.fill', titleKey: 'onb.s1.title', bodyKey: 'onb.s1.body' },
  { icon: 'bell.fill', titleKey: 'onb.s2.title', bodyKey: 'onb.s2.body' },
  { icon: 'sparkles', titleKey: 'onb.s3.title', bodyKey: 'onb.s3.body' },
];

/** First-run walkthrough (#13): three short slides explaining local-first
 * behavior, reminders/streaks, and the sync surface. Shown once per install
 * (AsyncStorage flag) over the signed-in app; the flag read gates rendering
 * so nothing flashes before it resolves. */
export function OnboardingModal() {
  const { t } = useLocale();
  const [visible, setVisible] = useState<boolean | null>(null); // null = loading
  const [step, setStep] = useState(0);
  const cardColor = useThemeColor({}, 'card');
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  if (visible === null) {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((raw) => setVisible(raw !== 'true'))
      .catch(() => setVisible(false));
    return null;
  }

  const finish = async () => {
    setVisible(false);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
  };

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;
  const cardWidth = Math.min(Dimensions.get('window').width - 48, 340);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)} style={[styles.card, { backgroundColor: cardColor, width: cardWidth }]}>
          <ThemedText type="subtitle" style={styles.welcome}>
            {t('onb.title')}
          </ThemedText>

          <View style={[styles.iconCircle, { backgroundColor: `${tint}1A` }]}>
            <IconSymbol name={slide.icon} size={36} color={tint} />
          </View>
          <ThemedText type="defaultSemiBold" style={styles.slideTitle}>
            {t(slide.titleKey)}
          </ThemedText>
          <ThemedText style={[styles.slideBody, { color: mutedColor }]}>{t(slide.bodyKey)}</ThemedText>

          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && { backgroundColor: tint, width: 18 }]} />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={finish} hitSlop={8}>
              <ThemedText type="link" style={styles.skip}>
                {t('common.skip')}
              </ThemedText>
            </Pressable>
            <View style={styles.cta}>
              <PrimaryButton
                label={isLast ? t('common.getStarted') : t('common.next')}
                onPress={() => (isLast ? finish() : setStep((s) => s + 1))}
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  welcome: { textAlign: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  slideTitle: { textAlign: 'center', fontSize: 17 },
  slideBody: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C4C9D2' },
  actions: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  skip: { fontSize: 13 },
  cta: { flex: 1, marginLeft: 12 },
});
