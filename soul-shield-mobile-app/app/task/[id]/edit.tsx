import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Task, TaskInput, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/auth-context';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCreateTask, useUpdateTask } from '@/hooks/queries/use-task-mutations';
import { getTaskByUuid } from '@/lib/db/tasks-repo';
import { todayISODate } from '@/lib/date';
import { getErrorMessage } from '@/lib/errors';
import { cancelTaskReminders, scheduleTaskReminders } from '@/lib/notifications';

export default function EditTaskScreen() {
  const { id, task: taskParam } = useLocalSearchParams<{ id: string; task: string }>();
  const { user } = useAuth();
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const tint = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const warningColor = useThemeColor({}, 'warning');
  const textColor = useThemeColor({}, 'text');

  const initialTask = useMemo<Task | undefined>(() => {
    try {
      const parsed = taskParam ? (JSON.parse(taskParam) as Task) : undefined;
      if (!parsed) return undefined;
      // List responses omitted reward_text for non-completed tasks until the
      // 2026-10-24 ungate — fall back to the raw local row so the edit form
      // always pre-fills the configured reward (also covers stale caches).
      if (!parsed.reward_text) {
        const raw = getTaskByUuid(parsed.task_id);
        if (raw?.rewardText) parsed.reward_text = raw.rewardText;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }, [taskParam]);

  const referenceDate = initialTask?.date ?? todayISODate();
  const updateTask = useUpdateTask(referenceDate);
  const createTask = useCreateTask(referenceDate);

  const isAdmin = user?.role === 'admin';
  const isArchived = initialTask?.is_active === false;

  const handleSubmit = (input: TaskUpdateInput) => {
    setError(null);
    updateTask.mutate(
      { id, input },
      { onError: (err) => setError(getErrorMessage(err)) }
    );
    // The local SQLite write already happened synchronously (see
    // hooks/queries/use-task-mutations.ts's useUpdateTask) - reminders are
    // rescheduled right away rather than waiting for the push to confirm.
    // Merge in case reminder_time was edited without touching recurrence
    // (recurrence_days is only sent when the user actually changed it).
    scheduleTaskReminders({
      task_id: id,
      title: input.title ?? initialTask?.title ?? '',
      reminder_time: input.reminder_time ?? initialTask?.reminder_time,
      recurrence_days: input.recurrence_days ?? initialTask?.recurrence_days,
      is_active: input.is_active ?? initialTask?.is_active,
    });
    router.back();
  };

  /** Duplicate (#8): clone this task (incl. sub-tasks as fresh rows) via the
   * normal create path — new client uuid, existing code handles persistence,
   * offline queuing and sync end-to-end. Reminders schedule immediately like
   * app/task/new.tsx does. */
  const handleDuplicate = () => {
    if (!initialTask || createTask.isPending) return;
    setError(null);
    const input: TaskInput = {
      title: `${initialTask.title} (copy)`,
      description: initialTask.description ?? undefined,
      recurrence_type: initialTask.recurrence_type,
      recurrence_days: initialTask.recurrence_days ?? [0, 1, 2, 3, 4, 5, 6],
      is_global: false,
      category_id: initialTask.category_id,
      reward_text: initialTask.reward_text ?? undefined,
      task_type: initialTask.task_type,
      target_count: initialTask.target_count ?? undefined,
      duration_seconds: initialTask.duration_seconds ?? undefined,
      reminder_time: initialTask.reminder_time ?? undefined,
      sub_tasks: (initialTask.sub_tasks ?? []).map((s) => ({
        title: s.title,
        description: s.description ?? null,
        task_type: s.task_type,
        target_count: s.target_count ?? undefined,
        duration_seconds: s.duration_seconds ?? undefined,
      })),
    };
    const uuid = createTask.mutate(input, {
      onError: (err) => setError(getErrorMessage(err)),
    });
    scheduleTaskReminders({
      task_id: uuid,
      title: input.title,
      reminder_time: input.reminder_time,
      recurrence_days: input.recurrence_days,
      is_active: true,
    });
    router.back();
  };

  /** Archive (#11) / restore: flips is_active; archived tasks disappear from
   * every list but stay restorable from Profile → Archived Tasks (their
   * history is kept either way). Archiving cancels the scheduled reminders
   * the same way deleting does (restoring self-heals them on the next sync). */
  const handleToggleArchive = () => {
    if (!id) return;
    setError(null);
    updateTask.mutate({ id, input: { is_active: !isArchived } });
    if (!isArchived) {
      cancelTaskReminders(id).catch(() => {});
    } else {
      scheduleTaskReminders({
        task_id: id,
        title: initialTask?.title ?? '',
        reminder_time: initialTask?.reminder_time,
        recurrence_days: initialTask?.recurrence_days,
        is_active: true,
      });
    }
    router.back();
  };

  /** The nav header ALREADY exists (app/task/_layout.tsx: "Edit Task" title +
   * close button) — the Duplicate / Archive(↔Restore) icon buttons are added
   * INTO that existing header via headerRight (icon-only, themed soft-tint
   * backgrounds), NOT a second custom nav. Overriding headerRight for this
   * screen replaces the layout's close-only button, so the close (X) is
   * re-included here at the far right. */
  const headerRight = () => (
    <View style={styles.headerActions}>
      {initialTask && !initialTask.is_global ? (
        <>
          <Pressable
            onPress={handleDuplicate}
            disabled={createTask.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('common.duplicate')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: `${tint}1A`, opacity: createTask.isPending ? 0.5 : pressed ? 0.7 : 1 },
            ]}>
            <IconSymbol name="doc.on.doc.fill" size={18} color={tint} />
          </Pressable>
          <Pressable
            onPress={handleToggleArchive}
            accessibilityRole="button"
            accessibilityLabel={isArchived ? t('archived.restore') : t('common.archive')}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: isArchived ? `${successColor}1A` : `${warningColor}1A`,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <IconSymbol
              name={isArchived ? 'arrow.counterclockwise' : 'archivebox.fill'}
              size={18}
              color={isArchived ? successColor : warningColor}
            />
          </Pressable>
        </>
      ) : null}
      <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <IconSymbol name="xmark" size={22} color={textColor} />
      </Pressable>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerRight }} />
      <TaskForm
        initialTask={initialTask}
        isAdmin={isAdmin}
        submitting={updateTask.isPending}
        error={error}
        submitLabel={t('common.save')}
        onSubmit={handleSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 4 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
