import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedbackCooldownError, MAX_FEEDBACK_LENGTH, formatWait, submitFeedback } from '@/api/feedback';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useSurface } from '@/hooks/use-ui-style';
import { getErrorMessage } from '@/lib/errors';
import type { I18nKey } from '@/lib/i18n';

const RATING_WORDS: Record<number, I18nKey> = {
  1: 'feedback.rating.1',
  2: 'feedback.rating.2',
  3: 'feedback.rating.3',
  4: 'feedback.rating.4',
  5: 'feedback.rating.5',
};

/** "5 h 20 min" / "40 min" until `until`, in the current language. */
export function useWaitLabel(): (until: Date) => string {
  const { t } = useLocale();
  return (until) => {
    const { hours, minutes } = formatWait(until);
    return hours > 0
      ? t('feedback.waitHM').replace('{h}', String(hours)).replace('{m}', String(minutes))
      : t('feedback.waitM').replace('{m}', String(minutes));
  };
}

/** Row of 5 tappable stars. Shared by the Profile card and the sheet. */
export function StarRow({
  value,
  onChange,
  size,
  disabled = false,
}: {
  value: number;
  onChange: (rating: number) => void;
  size: number;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const starColor = useThemeColor({}, 'warning');
  const emptyColor = useThemeColor({}, 'muted');
  return (
    <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={t('feedback.title')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          disabled={disabled}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${n} / 5`}
          accessibilityState={{ selected: n === value, disabled }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <IconSymbol name={n <= value ? 'star.fill' : 'star'} size={size} color={n <= value ? starColor : emptyColor} />
        </Pressable>
      ))}
    </View>
  );
}

interface FeedbackSheetProps {
  visible: boolean;
  /** Stars pre-selected when it opens (the star tapped on the Profile card). */
  initialRating: number;
  onClose: () => void;
  /** Called after a successful send, and when the server says this person
   * already sent one in the last 24 hours (so the card can update). */
  onSubmitted: (rating: number) => void;
  onCooldown: (nextAllowedAt: Date) => void;
}

/** Rate (1-5 stars) + optional message to the Soul Shield team. Works
 * without an account (sent as this phone's guest-user-<n>). */
export function FeedbackSheet({ visible, initialRating, onClose, onSubmitted, onCooldown }: FeedbackSheetProps) {
  const { token } = useAuth();
  const { t } = useLocale();
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const dangerColor = useThemeColor({}, 'danger');
  const successColor = useThemeColor({}, 'success');
  const surface = useSurface();
  const insets = useSafeAreaInsets();
  const waitLabel = useWaitLabel();

  const [rating, setRating] = useState(initialRating);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Fresh form each time it opens (keeps the typed message if only the
  // rating prop changes while open).
  useEffect(() => {
    if (visible) {
      setRating(initialRating);
      setError(null);
      setSent(false);
    }
  }, [visible, initialRating]);

  const handleSubmit = async () => {
    if (rating < 1 || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback(rating, message, token);
      setSent(true);
      setMessage('');
      onSubmitted(rating);
    } catch (e) {
      if (e instanceof FeedbackCooldownError) {
        setError(t('feedback.cooldown').replace('{time}', waitLabel(e.nextAllowedAt)));
        onCooldown(e.nextAllowedAt);
      } else {
        setError(getErrorMessage(e));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('feedback.close')}>
          {/* Swallow taps inside the sheet so they don't reach the backdrop's close handler. */}
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: cardColor, paddingBottom: insets.bottom + 20 }, surface('sheet')]}>
            <ThemeDecor kind="sheet" />
            <View style={[styles.handle, { backgroundColor: borderColor }]} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {sent ? (
                <View style={styles.thanks}>
                  <IconSymbol name="checkmark.circle.fill" size={48} color={successColor} />
                  <ThemedText type="subtitle" style={styles.center}>
                    {t('feedback.thanks.title')}
                  </ThemedText>
                  <ThemedText style={[styles.center, { color: mutedColor }]}>{t('feedback.thanks.body')}</ThemedText>
                  <PrimaryButton label={t('feedback.close')} variant="secondary" onPress={onClose} />
                </View>
              ) : (
                <>
                  <ThemedText type="subtitle">{t('feedback.title')}</ThemedText>
                  <ThemedText style={{ color: mutedColor }}>{t('feedback.subtitle')}</ThemedText>

                  <View style={styles.ratingBlock}>
                    <StarRow value={rating} onChange={setRating} size={40} />
                    <ThemedText type="defaultSemiBold" style={[styles.center, { color: mutedColor }]}>
                      {rating > 0 ? t(RATING_WORDS[rating]) : t('feedback.tapStar')}
                    </ThemedText>
                  </View>

                  <TextField
                    label={t('feedback.message.label')}
                    placeholder={t('feedback.message.placeholder')}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={MAX_FEEDBACK_LENGTH}
                    textAlignVertical="top"
                    style={styles.messageInput}
                    hint={`${message.length}/${MAX_FEEDBACK_LENGTH}`}
                  />

                  {error ? <ThemedText style={{ color: dangerColor }}>{error}</ThemedText> : null}

                  <PrimaryButton
                    label={t('feedback.submit')}
                    onPress={handleSubmit}
                    loading={sending}
                    disabled={rating < 1}
                  />
                  <PrimaryButton label={t('feedback.cancel')} variant="secondary" onPress={onClose} />
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  body: { gap: 14 },
  ratingBlock: { alignItems: 'center', gap: 8, paddingVertical: 6 },
  stars: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  center: { textAlign: 'center' },
  messageInput: { minHeight: 110 },
  thanks: { alignItems: 'center', gap: 12, paddingVertical: 12 },
});
