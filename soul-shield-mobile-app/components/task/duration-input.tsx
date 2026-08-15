import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TimerSelection } from '@/lib/timer/store';

const PRESET_MINUTES = [10, 15, 30, 45, 60];

interface DurationInputProps {
  selection: TimerSelection;
  onChange: (selection: TimerSelection) => void;
  disabled?: boolean;
}

function clamp(value: string, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(max, n);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatButtonLabel(selection: TimerSelection): string {
  const { hours, minutes, seconds } = selection;
  if (hours === 0 && minutes === 0 && seconds === 0) return 'Set duration';
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/** "Remind me"-style duration picker for task creation (see the Remind Me
 * time field above this one in task-form.tsx): a button showing the
 * currently selected duration opens a modal with a live HH:MM:SS preview at
 * the top and plain Hours (0-23) / Minutes (0-59) / Seconds (0-59) number
 * fields — typed directly, no dragging, per feedback that the Profile
 * Timer's wheel picker (components/timer/wheel-picker.tsx) was fiddly to
 * operate here. Presets remain for the common cases. The Profile Timer
 * screen (app/timer.tsx) is untouched and keeps its own wheel picker. */
export function DurationInput({ selection, onChange, disabled }: DurationInputProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<TimerSelection>(selection);

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  // Re-seeded from the last committed selection every time the modal opens,
  // so a previous edit dismissed without confirming doesn't linger into the
  // next open.
  const openModal = () => {
    if (disabled) return;
    setDraft(selection);
    setVisible(true);
  };

  const handleClose = () => setVisible(false);

  const isZero = draft.hours === 0 && draft.minutes === 0 && draft.seconds === 0;

  const handleConfirm = () => {
    if (isZero) return;
    onChange(draft);
    setVisible(false);
  };

  const applyPresetMinutes = (minutes: number) => {
    setDraft({ hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds: 0 });
  };

  const activePresetMinutes = draft.seconds === 0 ? draft.hours * 60 + draft.minutes : null;

  return (
    <>
      {/* TODO this button is for opening the duration picker modal */}
      <Pressable
        onPress={openModal}
        disabled={disabled}
        style={[styles.timeButton, { backgroundColor: cardColor, borderColor, opacity: disabled ? 0.5 : 1 }]}>
        <ThemedText type="defaultSemiBold">{formatButtonLabel(selection)}</ThemedText>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable onPress={(e) => e.stopPropagation()} style={[styles.card, { backgroundColor: cardColor }]}>
            <View style={styles.headerRow}>
              <ThemedText type="subtitle" style={styles.headerTitle}>
                Set Duration
              </ThemedText>
              {/* TODO this button is for closing the duration picker modal without saving */}
              <Pressable onPress={handleClose} hitSlop={10}>
                <IconSymbol name="xmark" size={20} color={mutedColor} />
              </Pressable>
            </View>

            <ThemedText style={[styles.preview, { color: textColor }]}>
              {pad(draft.hours)} : {pad(draft.minutes)} : {pad(draft.seconds)}
            </ThemedText>

            <View style={styles.fieldsRow}>
              <View style={styles.field}>
                <TextInput
                  value={draft.hours > 0 ? String(draft.hours) : ''}
                  onChangeText={(text) => setDraft((d) => ({ ...d, hours: clamp(text, 23) }))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={mutedColor}
                  selectTextOnFocus
                  style={[styles.fieldInput, { borderColor, color: textColor }]}
                />
                <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>h</ThemedText>
              </View>
              <View style={styles.field}>
                <TextInput
                  value={draft.minutes > 0 ? String(draft.minutes) : ''}
                  onChangeText={(text) => setDraft((d) => ({ ...d, minutes: clamp(text, 59) }))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={mutedColor}
                  selectTextOnFocus
                  style={[styles.fieldInput, { borderColor, color: textColor }]}
                />
                <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>m</ThemedText>
              </View>
              <View style={styles.field}>
                <TextInput
                  value={draft.seconds > 0 ? String(draft.seconds) : ''}
                  onChangeText={(text) => setDraft((d) => ({ ...d, seconds: clamp(text, 59) }))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={mutedColor}
                  selectTextOnFocus
                  style={[styles.fieldInput, { borderColor, color: textColor }]}
                />
                <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>s</ThemedText>
              </View>
            </View>

            <View style={styles.presetRow}>
              {PRESET_MINUTES.map((minutes) => {
                const active = activePresetMinutes === minutes;
                const label = minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;
                return (
                  // TODO this chip is for quickly setting the duration to a common preset value
                  <Pressable
                    key={minutes}
                    onPress={() => applyPresetMinutes(minutes)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? tintColor : borderColor,
                        backgroundColor: active ? tintColor : 'transparent',
                      },
                    ]}>
                    <ThemedText style={[styles.chipLabel, { color: active ? '#fff' : textColor }]}>{label}</ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* TODO this button is for confirming the selected duration and closing the modal */}
            <Pressable
              disabled={isZero}
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: tintColor, opacity: isZero ? 0.4 : pressed ? 0.85 : 1 },
              ]}>
              <ThemedText style={styles.confirmLabel}>Done</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  timeButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 24,
    gap: 18,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.25)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18 },
  preview: {
    textAlign: 'center',
    fontSize: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  fieldsRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  field: { alignItems: 'center', gap: 6 },
  fieldInput: {
    width: 72,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 12,
    fontSize: 20,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipLabel: { fontWeight: '600', fontSize: 13 },
  confirmButton: { borderRadius: 14, borderCurve: 'continuous', paddingVertical: 14, alignItems: 'center' },
  confirmLabel: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
