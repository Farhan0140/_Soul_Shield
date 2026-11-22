import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';
import type { I18nKey } from '@/lib/i18n';

/** Shop: the physical Soul Shield Counter (the ESP32 Bluetooth button the
 * app already pairs with). Not on sale yet — this page is a product overview
 * with a "Coming soon" state. When ordering opens, replace the notice card
 * with the buy action. */

const FEATURES: { icon: IconSymbolName; title: I18nKey; body: I18nKey }[] = [
  { icon: 'hand.tap.fill', title: 'shop.feature.press.title', body: 'shop.feature.press.body' },
  { icon: 'b.circle', title: 'shop.feature.wireless.title', body: 'shop.feature.wireless.body' },
  { icon: 'lightbulb.fill', title: 'shop.feature.feedback.title', body: 'shop.feature.feedback.body' },
  { icon: 'flag.fill', title: 'shop.feature.target.title', body: 'shop.feature.target.body' },
];

const STEPS: I18nKey[] = ['shop.step1', 'shop.step2', 'shop.step3'];

export default function ShopScreen() {
  const router = useRouter();
  const { t } = useLocale();
  const surface = useSurface();
  const cardColor = useThemeColor({}, 'card');
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');
  const warning = useThemeColor({}, 'warning');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <IconSymbol name="chevron.left" size={22} color={tint} />
        </Pressable>
        <ThemedText type="title">{t('shop.title')}</ThemedText>
      </View>

      {/* Product hero */}
      <View style={[styles.hero, { backgroundColor: cardColor }, surface('note')]}>
        <ThemeDecor kind="note" />
        <View style={[styles.device, { backgroundColor: `${tint}14`, borderColor: `${tint}33` }]}>
          <View style={[styles.deviceButton, { backgroundColor: tint }]} />
          <View style={[styles.deviceLed, { backgroundColor: `${tint}66` }]} />
        </View>
        <View style={[styles.pill, { backgroundColor: `${warning}1F` }]}>
          <ThemedText style={[styles.pillText, { color: warning }]}>{t('shop.comingSoon')}</ThemedText>
        </View>
        <ThemedText type="subtitle" style={styles.center}>
          {t('shop.deviceName')}
        </ThemedText>
        <ThemedText style={[styles.center, { color: mutedColor }]}>{t('shop.tagline')}</ThemedText>
      </View>

      {/* Features */}
      <View style={styles.section}>
        <ThemedText type="defaultSemiBold">{t('shop.features')}</ThemedText>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={[styles.featureRow, { backgroundColor: cardColor }, surface('card')]}>
            <ThemeDecor kind="card" />
            <View style={[styles.iconCircle, { backgroundColor: `${tint}1A` }, surface('iconCircle')]}>
              <ThemeDecor kind="iconCircle" stroke={tint} />
              <IconSymbol name={feature.icon} size={20} color={tint} />
            </View>
            <View style={styles.featureText}>
              <ThemedText type="defaultSemiBold">{t(feature.title)}</ThemedText>
              <ThemedText style={{ color: mutedColor, fontSize: 14 }}>{t(feature.body)}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <ThemedText type="defaultSemiBold">{t('shop.howItWorks')}</ThemedText>
        <View style={[styles.steps, { backgroundColor: cardColor }, surface('card')]}>
          <ThemeDecor kind="card" />
          {STEPS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepNumber, { borderColor: tint }]}>
                <ThemedText style={[styles.stepNumberText, { color: tint }]}>{index + 1}</ThemedText>
              </View>
              <ThemedText style={styles.stepText}>{t(step)}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.notice, { borderColor: `${mutedColor}40` }]}>
        <IconSymbol name="bag.fill" size={18} color={mutedColor} />
        <ThemedText style={[styles.noticeText, { color: mutedColor }]}>{t('shop.notice')}</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingBottom: 64, gap: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  // A simple drawing of the device: a rounded puck with one big button + LED.
  device: {
    width: 104,
    height: 104,
    borderRadius: 32,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  deviceButton: { width: 48, height: 48, borderRadius: 24 },
  deviceLed: { position: 'absolute', top: 14, right: 16, width: 8, height: 8, borderRadius: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 13, fontWeight: '700' },
  center: { textAlign: 'center' },
  section: { gap: 12 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, gap: 2 },
  steps: { padding: 16, gap: 14, borderRadius: 16, borderCurve: 'continuous' },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  stepText: { flex: 1 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noticeText: { flex: 1, fontSize: 14 },
});
