import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import type { Task, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { useAuth } from '@/context/auth-context';
import { useUpdateTask } from '@/hooks/queries/use-task-mutations';
import { getErrorMessage } from '@/lib/errors';
import { todayISODate } from '@/lib/date';
import { scheduleTaskReminders } from '@/lib/notifications';

export default function EditTaskScreen() {
  const { id, task: taskParam } = useLocalSearchParams<{ id: string; task: string }>();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const initialTask = useMemo<Task | undefined>(() => {
    try {
      return taskParam ? (JSON.parse(taskParam) as Task) : undefined;
    } catch {
      return undefined;
    }
  }, [taskParam]);

  const updateTask = useUpdateTask(initialTask?.date ?? todayISODate());

  const isAdmin = user?.role === 'admin';

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

  return (
    <TaskForm
      initialTask={initialTask}
      isAdmin={isAdmin}
      submitting={updateTask.isPending}
      error={error}
      submitLabel="Save Changes"
      onSubmit={handleSubmit}
    />
  );
}
