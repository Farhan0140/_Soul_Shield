import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WHEEL_COLUMN_WIDTH, WheelPicker } from '@/components/timer/wheel-picker';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TimerSelection } from '@/lib/timer/store';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_OR_SECONDS = Array.from({ length: 60 }, (_, i) => i);
const SEPARATOR_WIDTH = 20;

interface DurationPickerProps {
  selection: TimerSelection;
  onChange: (selection: TimerSelection) => void;
  disabled?: boolean;
  /** Forwarded to each wheel's selected-value color — see wheel-picker.tsx. */
  selectedColor?: string;
}

/** The three wheel-style hours/minutes/seconds columns below the timer ring,
 * with `:` separators centered on the wheels and h/min/sec labels beneath —
 * matches the reference screenshot's layout. Disabled (and dimmed, see
 * wheel-picker.tsx) once the timer leaves 'idle', since editing a duration
 * mid-countdown doesn't map to anything meaningful. */
export function DurationPicker({ selection, onChange, disabled, selectedColor }: DurationPickerProps) {
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <View style={styles.block}>
      <View style={styles.wheelsRow}>
        <WheelPicker
          values={HOURS}
          selected={selection.hours}
          disabled={disabled}
          selectedColor={selectedColor}
          onChange={(hours) => onChange({ ...selection, hours })}
        />
        <ThemedText style={[styles.separator, { color: mutedColor }]}>:</ThemedText>
        <WheelPicker
          values={MINUTES_OR_SECONDS}
          selected={selection.minutes}
          disabled={disabled}
          selectedColor={selectedColor}
          onChange={(minutes) => onChange({ ...selection, minutes })}
        />
        <ThemedText style={[styles.separator, { color: mutedColor }]}>:</ThemedText>
        <WheelPicker
          values={MINUTES_OR_SECONDS}
          selected={selection.seconds}
          disabled={disabled}
          selectedColor={selectedColor}
          onChange={(seconds) => onChange({ ...selection, seconds })}
        />
      </View>
      <View style={styles.labelsRow}>
        <ThemedText style={[styles.label, { color: mutedColor }]}>h</ThemedText>
        <View style={styles.separatorSpacer} />
        <ThemedText style={[styles.label, { color: mutedColor }]}>min</ThemedText>
        <View style={styles.separatorSpacer} />
        <ThemedText style={[styles.label, { color: mutedColor }]}>sec</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', gap: 6 },
  wheelsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  separator: { width: SEPARATOR_WIDTH, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  labelsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  separatorSpacer: { width: SEPARATOR_WIDTH },
  label: { width: WHEEL_COLUMN_WIDTH, fontSize: 12, textAlign: 'center' },
});
