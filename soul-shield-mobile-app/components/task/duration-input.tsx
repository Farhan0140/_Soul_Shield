import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TimerSelection } from '@/lib/timer/store';

const PRESET_MINUTES = [10, 15, 30, 45, 60];

interface DurationInputProps {
  selection: TimerSelection;
  onChange: (selection: TimerSelection) => void;
  disabled?: boolean;
}

function clampMinutePart(value: string): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(59, n);
}

function clampHourPart(value: string): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(23, n);
}

/** Preset chips + plain Hours/Minutes number fields for setting a Timer
 * Task's duration at creation time. Task creation only — the wheel-picker
 * scroll-and-snap gesture (components/timer/wheel-picker.tsx) turned out to
 * be fiddly to operate precisely here, whereas the Profile Timer screen
 * (app/timer.tsx) keeps it unchanged, since that's a different, more
 * playful "set it and forget it" context. Seconds are intentionally not
 * exposed — task durations are set in whole minutes/hours. */
export function DurationInput({ selection, onChange, disabled }: DurationInputProps) {
  const tintColor = useThemeColor({}, 'tint');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const textColor = useThemeColor({}, 'text');

  const totalMinutes = selection.hours * 60 + selection.minutes;
  const activePreset = selection.seconds === 0 && PRESET_MINUTES.includes(totalMinutes) ? totalMinutes : null;

  const applyPresetMinutes = (minutes: number) => {
    onChange({ hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds: 0 });
  };

  return (
    <View style={styles.container}>
      <View style={styles.presetRow}>
        {PRESET_MINUTES.map((minutes) => {
          const active = activePreset === minutes;
          const label = minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`;
          return (
            // TODO this chip is for quickly setting the duration to a common preset value
            <Pressable
              key={minutes}
              disabled={disabled}
              onPress={() => applyPresetMinutes(minutes)}
              style={[
                styles.chip,
                { borderColor: active ? tintColor : borderColor, backgroundColor: active ? tintColor : cardColor },
                disabled && styles.chipDisabled,
              ]}>
              <ThemedText style={[styles.chipLabel, { color: active ? '#fff' : textColor }]}>{label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.customRow}>
        <View style={styles.customField}>
          <TextField
            label="Hours"
            value={selection.hours > 0 ? String(selection.hours) : ''}
            onChangeText={(text) => onChange({ hours: clampHourPart(text), minutes: selection.minutes, seconds: 0 })}
            keyboardType="number-pad"
            placeholder="0"
            editable={!disabled}
          />
        </View>
        <View style={styles.customField}>
          <TextField
            label="Minutes"
            value={selection.minutes > 0 ? String(selection.minutes) : ''}
            onChangeText={(text) => onChange({ hours: selection.hours, minutes: clampMinutePart(text), seconds: 0 })}
            keyboardType="number-pad"
            placeholder="0"
            editable={!disabled}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipDisabled: { opacity: 0.5 },
  chipLabel: { fontWeight: '600', fontSize: 13 },
  customRow: { flexDirection: 'row', gap: 12 },
  customField: { flex: 1 },
});
