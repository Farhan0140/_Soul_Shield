import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeDecor } from '@/components/ui/theme-decor';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHandFont, useOnAccent, useSurface } from '@/hooks/use-ui-style';

interface CustomIncrementModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
}

/** Whole numbers greater than 0 only — rejects empty/non-numeric/negative/zero
 * input rather than silently clamping it, so the confirm button simply stays
 * disabled until the text represents a valid amount. */
function parsePositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function CustomIncrementModal({ visible, onClose, onConfirm }: CustomIncrementModalProps) {
  const [text, setText] = useState('');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const dangerColor = useThemeColor({}, 'danger');
  const surface = useSurface();
  const onAccent = useOnAccent();
  const handFont = useHandFont();

  const amount = parsePositiveInt(text);
  const isInvalid = text.length > 0 && amount === null;

  const handleClose = () => {
    setText('');
    onClose();
  };

  const handleConfirm = () => {
    if (amount === null) return;
    onConfirm(amount);
    setText('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* Keeps the card (and its input) above the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={styles.avoider}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.card, { backgroundColor: cardColor }, surface('modal')]}>
            <ThemeDecor kind="modal" />
            <View style={styles.headerRow}>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                Add Custom Amount
              </ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} hitSlop={10}>
                <IconSymbol name="xmark" size={20} color={mutedColor} />
              </Pressable>
            </View>

            <View>
            <ThemeDecor kind="input" stroke={isInvalid ? dangerColor : undefined} />
            <TextInput
              value={text}
              onChangeText={setText}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="Enter amount"
              placeholderTextColor={mutedColor}
              autoFocus
              style={[
                styles.input,
                { borderColor: isInvalid ? dangerColor : borderColor, color: textColor },
                surface('input') as TextStyle | undefined,
                surface('input') && isInvalid ? { borderColor: dangerColor } : null,
                handFont.body,
              ]}
            />
            </View>
            {isInvalid ? (
              <ThemedText style={[styles.error, { color: dangerColor }]}>
                Enter a whole number greater than 0.
              </ThemedText>
            ) : null}

            <Pressable
              disabled={amount === null}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: tintColor, opacity: amount === null ? 0.4 : pressed ? 0.85 : 1 },
                surface('button'),
              ]}>
              <ThemeDecor kind="button" hatch={tintColor} />
              <ThemedText style={[styles.confirmLabel, { color: onAccent }]}>{amount !== null ? `Add ${amount}` : 'Add'}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoider: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 24,
    gap: 14,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  error: { fontSize: 13, marginTop: -8 },
  confirmButton: {
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
