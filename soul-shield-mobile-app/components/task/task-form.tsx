import { useHeaderHeight } from '@react-navigation/elements';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import type {
  RecurrenceType,
  SubTaskInput,
  Task,
  TaskInput,
  TaskType,
  TaskUpdateInput,
} from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { CategoryPicker } from '@/components/task/category-picker';
import { DayOfWeekPicker } from '@/components/task/day-of-week-picker';
import { DurationInput } from '@/components/task/duration-input';
import { RecurrencePicker } from '@/components/task/recurrence-picker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TapShadowButton } from '@/components/ui/tap-shadow-button';
import { TextField } from '@/components/ui/text-field';
import { useCategoriesQuery } from '@/hooks/queries/use-categories';
import { useThemeColor } from '@/hooks/use-theme-color';
import { secondsToSelection, selectionToSeconds } from '@/lib/timer/duration';
import type { TimerSelection } from '@/lib/timer/store';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_REMINDER_HOUR = 20;
const DEFAULT_TIMER_SELECTION: TimerSelection = { hours: 0, minutes: 5, seconds: 0 };

interface SubTaskDraft {
  id?: number;
  title: string;
  task_type: TaskType;
  target_count: string;
  duration_selection: TimerSelection;
}

function emptySubTaskDraft(): SubTaskDraft {
  return { title: '', task_type: 'normal', target_count: '', duration_selection: DEFAULT_TIMER_SELECTION };
}

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
  const [durationSelection, setDurationSelection] = useState<TimerSelection>(
    initialTask?.duration_seconds != null
      ? secondsToSelection(initialTask.duration_seconds)
      : DEFAULT_TIMER_SELECTION
  );
  const [rewardText, setRewardText] = useState(initialTask?.reward_text ?? '');
  const [isGlobal, setIsGlobal] = useState(initialTask?.is_global ?? defaultGlobal ?? false);
  const [reminderEnabled, setReminderEnabled] = useState(Boolean(initialTask?.reminder_time));
  const [reminderTime, setReminderTime] = useState(() => parseReminderTime(initialTask?.reminder_time));
  const [showTimePicker, setShowTimePicker] = useState(false);

  const initialSubTasksEnabled = Boolean(initialTask?.sub_tasks?.length);
  const [subTasksEnabled, setSubTasksEnabled] = useState(initialSubTasksEnabled);
  const [subTaskDrafts, setSubTaskDrafts] = useState<SubTaskDraft[]>(() =>
    initialTask?.sub_tasks?.length
      ? initialTask.sub_tasks.map((s) => ({
          id: s.sub_task_id,
          title: s.title,
          task_type: s.task_type,
          target_count: s.target_count != null ? String(s.target_count) : '',
          duration_selection:
            s.duration_seconds != null ? secondsToSelection(s.duration_seconds) : DEFAULT_TIMER_SELECTION,
        }))
      : [emptySubTaskDraft()]
  );

  const handleSubTasksEnabledChange = (value: boolean) => {
    setSubTasksEnabled(value);
    if (value && subTaskDrafts.length === 0) setSubTaskDrafts([emptySubTaskDraft()]);
  };

  // Sub-tasks only make sense under a Normal parent — a Counter/Timer
  // parent's own progress/duration become meaningless once completion is
  // derived from children (Counter) or is intrinsic to a single countdown
  // (Timer), so switching away from Normal drops any sub-tasks rather than
  // leaving a confusing combination in place.
  const handleTaskTypeChange = (value: TaskType) => {
    setTaskType(value);
    if (value === 'counter' || value === 'timer') setSubTasksEnabled(false);
  };

  const updateSubTaskDraft = (index: number, patch: Partial<SubTaskDraft>) => {
    setSubTaskDrafts((drafts) => drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const removeSubTaskDraft = (index: number) => {
    setSubTaskDrafts((drafts) => drafts.filter((_, i) => i !== index));
  };

  const addSubTaskDraft = () => {
    setSubTaskDrafts((drafts) => [...drafts, emptySubTaskDraft()]);
  };

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

  const subTasksValid =
    !subTasksEnabled ||
    (subTaskDrafts.length > 0 &&
      subTaskDrafts.every((d) => {
        if (d.title.trim().length === 0) return false;
        if (d.task_type === 'counter') return Number(d.target_count) > 0 && d.target_count.trim().length > 0;
        if (d.task_type === 'timer') return selectionToSeconds(d.duration_selection) > 0;
        return true;
      }));

  const isValid =
    title.trim().length > 0 &&
    (!recurrenceNeedsDays || recurrenceDays.length > 0) &&
    (taskType !== 'counter' || (Number(targetCount) > 0 && targetCount.trim().length > 0)) &&
    (taskType !== 'timer' || selectionToSeconds(durationSelection) > 0) &&
    subTasksValid;

  const handleSubmit = () => {
    if (!isValid) return;

    const subTasks: SubTaskInput[] | undefined = subTasksEnabled
      ? subTaskDrafts.map((d) => ({
          ...(d.id != null ? { id: d.id } : {}),
          title: d.title.trim(),
          task_type: d.task_type,
          target_count: d.task_type === 'counter' ? Number(d.target_count) : undefined,
          duration_seconds: d.task_type === 'timer' ? selectionToSeconds(d.duration_selection) : undefined,
        }))
      : isEditMode && initialSubTasksEnabled
        ? []
        : undefined;

    const base = {
      title: title.trim(),
      description: description.trim() || undefined,
      category_id: categoryId,
      reward_text: rewardText.trim() || undefined,
      task_type: taskType,
      target_count: taskType === 'counter' ? Number(targetCount) : undefined,
      duration_seconds: taskType === 'timer' ? selectionToSeconds(durationSelection) : undefined,
      sub_tasks: subTasks,
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
      <TextField
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Morning Dhikr"
        shadowed
      />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details"
        multiline
        style={styles.multiline}
        shadowed
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
          {/* TODO this button is for setting the task type to normal (simple checkbox completion) */}
          <View style={{ flex: 1, borderWidth:1, borderColor: '#c7c7c7', borderRadius: 16 }}>
            <PrimaryButton
              label="Normal"
              variant={taskType === 'normal' ? 'primary' : 'secondary'}
              onPress={() => handleTaskTypeChange('normal')}
            />
          </View>

          {/* TODO this button is for setting the task type to counter (progress towards a target count) */}
          <View style={{ flex: 1, borderWidth:1, borderColor: '#c7c7c7', borderRadius: 16 }}>
            <PrimaryButton
              label="Counter"
              variant={taskType === 'counter' ? 'primary' : 'secondary'}
              onPress={() => handleTaskTypeChange('counter')}
            />
          </View>

          {/* TODO this button is for setting the task type to timer (completes once a set duration elapses) */}
          <View style={{ flex: 1, borderWidth:1, borderColor: '#c7c7c7', borderRadius: 16 }}>
            <PrimaryButton
              label="Timer"
              variant={taskType === 'timer' ? 'primary' : 'secondary'}
              onPress={() => handleTaskTypeChange('timer')}
            />
          </View>
        </View>
        {taskType === 'counter' ? (
          <TextField
            label="Target Count"
            value={targetCount}
            onChangeText={setTargetCount}
            keyboardType="number-pad"
            placeholder="e.g. 100"
            shadowed
          />
        ) : null}
        {taskType === 'timer' ? (
          <View style={styles.durationField}>
            <ThemedText style={{ color: mutedColor }}>Duration</ThemedText>
            <DurationInput selection={durationSelection} onChange={setDurationSelection} />
          </View>
        ) : null}
      </View>

      {taskType === 'normal' ? (
        <View style={styles.field}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <ThemedText type="defaultSemiBold">Do you want to add sub-tasks?</ThemedText>
              <ThemedText style={{ color: mutedColor }}>
                Break this task into smaller Normal, Counter, or Timer sub-tasks. The task&apos;s status
                will follow how many of them are done.
              </ThemedText>
            </View>
            <Switch value={subTasksEnabled} onValueChange={handleSubTasksEnabledChange} />
          </View>

          {subTasksEnabled ? (
            <View style={styles.subTasks}>
              {subTaskDrafts.map((draft, index) => (
                <View key={index} style={[styles.subTaskRow, { backgroundColor: cardColor, borderColor }]}>
                  <View style={styles.subTaskRowHeader}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label={`Sub-task ${index + 1}`}
                        value={draft.title}
                        onChangeText={(text) => updateSubTaskDraft(index, { title: text })}
                        placeholder="e.g. Read 1 page"
                        shadowed
                      />
                    </View>
                    {/* TODO this button is for removing this sub-task draft from the form */}
                    <Pressable
                      onPress={() => removeSubTaskDraft(index)}
                      hitSlop={8}
                      style={styles.subTaskRemove}>
                      <IconSymbol name="xmark" size={18} color={mutedColor} />
                    </Pressable>
                  </View>

                  <View style={styles.typeRow}>
                    {/* TODO this button is for setting this sub-task's type to normal */}
                    <View style={{ flex: 1, borderWidth:1, borderColor: '#c7c7c7', borderRadius: 16 }}>
                      <PrimaryButton
                        label="Normal"
                        variant={draft.task_type === 'normal' ? 'primary' : 'secondary'}
                        onPress={() => updateSubTaskDraft(index, { task_type: 'normal' })}
                      />
                    </View>

                    {/* TODO this button is for setting this sub-task's type to counter */}
                    <View style={{ flex: 1, borderWidth:1, borderColor: '#c7c7c7', borderRadius: 16 }}>
                      <PrimaryButton
                        label="Counter"
                        variant={draft.task_type === 'counter' ? 'primary' : 'secondary'}
                        onPress={() => updateSubTaskDraft(index, { task_type: 'counter' })}
                      />
                    </View>

                    {/* TODO this button is for setting this sub-task's type to timer */}
                    <View style={{ flex: 1, borderWidth:1, borderColor: '#c7c7c7', borderRadius: 16 }}>
                      <PrimaryButton
                        label="Timer"
                        variant={draft.task_type === 'timer' ? 'primary' : 'secondary'}
                        onPress={() => updateSubTaskDraft(index, { task_type: 'timer' })}
                      />
                    </View>
                  </View>

                  {draft.task_type === 'counter' ? (
                    <TextField
                      label="Target Count"
                      value={draft.target_count}
                      onChangeText={(text) => updateSubTaskDraft(index, { target_count: text })}
                      keyboardType="number-pad"
                      placeholder="e.g. 10"
                      shadowed
                    />
                  ) : null}
                  {draft.task_type === 'timer' ? (
                    <View style={styles.durationField}>
                      <ThemedText style={{ color: mutedColor }}>Duration</ThemedText>
                      <DurationInput
                        selection={draft.duration_selection}
                        onChange={(duration_selection) => updateSubTaskDraft(index, { duration_selection })}
                      />
                    </View>
                  ) : null}
                </View>
              ))}

              {/* TODO this button is for adding another empty sub-task draft to the list */}
              <PrimaryButton label="Add More Sub-Tasks" variant="secondary" onPress={addSubTaskDraft} />
            </View>
          ) : null}
        </View>
      ) : null}

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
            {/* TODO this button is for opening the time picker to set the reminder time */}
            <TapShadowButton onPress={() => setShowTimePicker(true)} accessibilityLabel="Set reminder time">
              <ThemedText type="defaultSemiBold">
                {reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </ThemedText>
            </TapShadowButton>
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

      <TextField
        label="Reward Text"
        value={rewardText}
        onChangeText={setRewardText}
        placeholder="Optional completion message"
        shadowed
      />

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

      {/* TODO this button is for submitting the form to create or update the task (label is "Create Task" or "Save") */}
      <PrimaryButton label={submitLabel} onPress={handleSubmit} loading={submitting} disabled={!isValid} />
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20 },
  field: { gap: 10 },
  durationField: { gap: 8 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { flex: 1, gap: 4 },
  subTasks: { gap: 12, marginTop: 4 },
  subTaskRow: {
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 12,
    gap: 10,
  },
  subTaskRowHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  subTaskRemove: { padding: 8 },
  error: { color: '#D0342C', fontSize: 14 },
});
