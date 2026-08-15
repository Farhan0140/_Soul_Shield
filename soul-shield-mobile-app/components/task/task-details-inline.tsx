import { StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { weekdayLabel } from '@/lib/date';
import { formatDurationLabel } from '@/lib/timer/format';

interface TaskDetailsInlineProps {
  task: Task;
}

function recurrenceLabel(task: Task): string {
  if (task.recurrence_type === 'daily') return 'Every day';
  const days = (task.recurrence_days ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map(weekdayLabel)
    .join(', ');
  const label = task.recurrence_type === 'weekly' ? 'Weekly' : 'Custom days';
  return days ? `${label} — ${days}` : label;
}

const formatTimeTo12Hour = (time: string) => {
  if (!time) return "";

  const [hour, minute] = time.split(":").map(Number);

  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
};

/** Extra fields that don't fit in the card's collapsed header, shown inline
 * (not as a modal) directly below it when the title/description is tapped —
 * recurrence, task type, reminder time, and an upcoming-reward preview for
 * tasks not yet completed (RewardBanner already covers the completed case). */
export function TaskDetailsInline({ task }: TaskDetailsInlineProps) {
  const mutedColor = useThemeColor({}, 'muted');
  const successColor = useThemeColor({}, 'success');
  const borderColor = useThemeColor({}, 'border');

  const isCounter = task.task_type === 'counter';
  const isTimer = task.task_type === 'timer';
  const isCompleted = task.status === 'completed';

  return (
    <View style={[styles.container, { borderColor }]}>
      <View style={styles.row}>
        <IconSymbol name="repeat" size={14} color={mutedColor} />
        <ThemedText style={[styles.text, { color: mutedColor }]}>{recurrenceLabel(task)}</ThemedText>
      </View>

      <View style={styles.row}>
        <IconSymbol name="checkmark.square" size={14} color={mutedColor} />
        <ThemedText style={[styles.text, { color: mutedColor }]}>
          {isCounter
            ? `Counter task — target ${task.target_count}`
            : isTimer
              ? `Timer task — ${formatDurationLabel(task.duration_seconds ?? 0)}`
              : 'Normal task'}
        </ThemedText>
      </View>

      {task.reminder_time ? (
        <View style={styles.row}>
          <IconSymbol name="bell.fill" size={14} color={mutedColor} />
          <ThemedText style={[styles.text, { color: mutedColor }]}>
            Reminder at {formatTimeTo12Hour(task.reminder_time)}
          </ThemedText>
        </View>
      ) : null}

      {!isCompleted && task.reward_text ? (
        <View style={styles.row}>
          <IconSymbol name="sparkles" size={14} color={successColor} />
          <ThemedText style={[styles.text, { color: successColor }]}>{task.reward_text}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingTop: 10, gap: 6, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontSize: 13, flex: 1 },
});
