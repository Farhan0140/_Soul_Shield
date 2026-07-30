import { useHeaderHeight } from '@react-navigation/elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import type { RecurrenceType, Task, TaskInput, TaskType, TaskUpdateInput } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { CategoryPicker } from '@/components/task/category-picker';
import { DayOfWeekPicker } from '@/components/task/day-of-week-picker';
import { RecurrencePicker } from '@/components/task/recurrence-picker';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import { useThemeColor } from '@/hooks/use-theme-color';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_REMINDER_HOUR = 20;

function parseReminderTime(value?: string | null): Date {
  const date = new Date();
  const [hour, minute] = (value ?? '').split(':').map(Number);
  if (Number.isFinite(hour) && Number.isFinite(minute)) {
    date.setHours(hour, minute, 0, 0);
  } else {
    date.setHours(DEFAULT_REMINDER_HOUR, 0, 0, 0);
  }
  return date;
}

function formatReminderTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

interface TaskFormProps {
  initialTask?: Task;
  isAdmin: boolean;
  defaultGlobal?: boolean;
  submitting: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (input: TaskInput | TaskUpdateInput) => void;
}

export function TaskForm({
  initialTask,
  isAdmin,
  defaultGlobal,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: TaskFormProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const mutedColor = useThemeColor({}, 'muted');
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const isEditMode = Boolean(initialTask);
  const headerHeight = useHeaderHeight();

  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [description, setDescription] = useState(initialTask?.description ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(initialTask?.category_id ?? null);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    initialTask?.recurrence_type ?? 'daily'
  );
  // recurrence_days may still be unknown for tasks fetched before this field was
  // added to the list/history response — default to empty rather than guessing,
  // and only send recurrence fields on edit if the user touches them.
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(
    initialTask?.recurrence_days ?? (recurrenceType === 'daily' ? ALL_DAYS : [])
  );
  const [recurrenceTouched, setRecurrenceTouched] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>(initialTask?.task_type ?? 'normal');
  const [targetCount, setTargetCount] = useState(
    initialTask?.target_count != null ? String(initialTask.target_count) : ''
  );
  const [rewardText, setRewardText] = useState(initialTask?.reward_text ?? '');
  const [isGlobal, setIsGlobal] = useState(initialTask?.is_global ?? defaultGlobal ?? false);
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(initialTask?.reminder_time));
  const [reminderTime, setReminderTime] = useState(() => parseReminderTime(initialTask?.reminder_time));
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleRecurrenceChange = (value: RecurrenceType) => {
    setRecurrenceType(value);
    setRecurrenceTouched(true);
    if (value === 'daily') setRecurrenceDays(ALL_DAYS);
  };

  const handleDaysChange = (days: number[]) => {
    setRecurrenceDays(days);
    setRecurrenceTouched(true);
  };

  const recurrenceNeedsDays = recurrenceType !== 'daily' && (!isEditMode || recurrenceTouched);

  const isValid =
    title.trim().length > 0 &&
    (!recurrenceNeedsDays || recurrenceDays.length > 0) &&
    (taskType === 'normal' || (Number(targetCount) > 0 && targetCount.trim().length > 0));

  const handleSubmit = () => {
    if (!isValid) return;

    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      category_id: categoryId,
      reward_text: rewardText.trim() || undefined,
      task_type: taskType,
      target_count: taskType === 'counter' ? Number(targetCount) : undefined,
    };

    if (isEditMode) {
      const input: TaskUpdateInput = {
        ...base,
        // Always sent on edit (unlike create): '' explicitly clears an existing
        // reminder, so turning the switch off actually removes it server-side.
        reminder_time: reminderEnabled ? formatReminderTime(reminderTime) : '',
        ...(recurrenceTouched
          ? {
              recurrence_type: recurrenceType,
              recurrence_days: recurrenceType === 'daily' ? ALL_DAYS : recurrenceDays,
            }
          : {}),
      };
      onSubmit(input);
    } else {
      const input: TaskInput = {
        ...base,
        is_global: isAdmin ? isGlobal : false,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceType === 'daily' ? ALL_DAYS : recurrenceDays,
        reminder_time: reminderEnabled ? formatReminderTime(reminderTime) : undefined,
      };
      onSubmit(input);
    }
  };

  return (
    <KeyboardAvoidingScrollView keyboardVerticalOffset={headerHeight} contentContainerStyle={styles.content}>
      <TextField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Morning Dhikr" />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details"
        multiline
        style={styles.multiline}
      />

      <View style={styles.field}>
        <ThemedText type="defaultSemiBold">Category</ThemedText>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </View>

      <View style={styles.field}>
        <ThemedText type="defaultSemiBold">Recurrence</ThemedText>
        {isEditMode && !recurrenceTouched ? (
          <ThemedText style={{ color: mutedColor, fontSize: 13 }}>
            Current schedule kept as-is. Change it below only if you want to update it.
          </ThemedText>
        ) : null}
        <RecurrencePicker value={recurrenceType} onChange={handleRecurrenceChange} />
        {recurrenceType !== 'daily' ? (
          <DayOfWeekPicker value={recurrenceDays} onChange={handleDaysChange} />
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="defaultSemiBold">Task Type</ThemedText>
        <View style={styles.typeRow}>
          <PrimaryButton
            label="Normal"
            variant={taskType === 'normal' ? 'primary' : 'secondary'}
            onPress={() => setTaskType('normal')}
          />
          <PrimaryButton
            label="Counter"
            variant={taskType === 'counter' ? 'primary' : 'secondary'}
            onPress={() => setTaskType('counter')}
          />
        </View>
        {taskType === 'counter' ? (
          <TextField
            label="Target Count"
            value={targetCount}
            onChangeText={setTargetCount}
            keyboardType="number-pad"
            placeholder="e.g. 100"
          />
        ) : null}
      </View>

      <TextField
        label="Reward Text"
        value={rewardText}
        onChangeText={setRewardText}
        placeholder="Optional completion message"
      />

      <View style={styles.field}>
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="defaultSemiBold">Remind me</ThemedText>
            <ThemedText style={{ color: mutedColor }}>
              Get a notification at this time on each scheduled day.
            </ThemedText>
          </View>
          <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
        </View>
        {reminderEnabled ? (
          <>
            <Pressable
              onPress={() => setShowTimePicker(true)}
              style={[styles.timeButton, { backgroundColor: cardColor, borderColor }]}>
              <ThemedText type="defaultSemiBold">
                {reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </ThemedText>
            </Pressable>
            {showTimePicker ? (
              <DateTimePicker
                value={reminderTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_event, selected) => {
                  if (Platform.OS === 'android') setShowTimePicker(false);
                  if (selected) setReminderTime(selected);
                }}
              />
            ) : null}
          </>
        ) : null}
      </View>

      {isAdmin ? (
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <ThemedText type="defaultSemiBold">Make mandatory for all users?</ThemedText>
            <ThemedText style={{ color: mutedColor }}>
              Fixed tasks appear for every user and can only be managed by admins.
            </ThemedText>
          </View>
          <Switch value={isGlobal} onValueChange={setIsGlobal} />
        </View>
      ) : null}

      {error ? (
        <ThemedText selectable style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label={submitLabel} onPress={handleSubmit} loading={submitting} disabled={!isValid} />
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  field: { gap: 10 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, gap: 4 },
  timeButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  error: { color: '#D0342C', fontSize: 14 },
});
