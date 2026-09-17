import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { TaskInput, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { useAuth } from '@/context/auth-context';
import { useCreateTask } from '@/hooks/queries/use-task-mutations';
import { getErrorMessage } from '@/lib/errors';
import { scheduleTaskReminders } from '@/lib/notifications';

export default function NewTaskScreen() {
  const { global } = useLocalSearchParams<{ global?: string }>();
  const { user } = useAuth();
  const createTask = useCreateTask();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // TaskForm always emits a fully-populated TaskInput in create mode. The
  // new task's uuid is known synchronously (the local SQLite write already
  // happened by the time .mutate() returns - see
  // hooks/queries/use-task-mutations.ts's useCreateTask), so reminders are
  // scheduled right away instead of waiting for the push to confirm, which
  // may not happen for a while if offline.
  const handleSubmit = (input: TaskInput | TaskUpdateInput) => {
    setError(null);
    const fullInput = input as TaskInput;
    const uuid = createTask.mutate(fullInput, {
      onError: (err) => setError(getErrorMessage(err)),
    });
    scheduleTaskReminders({
      task_id: uuid,
      title: fullInput.title,
      reminder_time: fullInput.reminder_time,
      recurrence_days: fullInput.recurrence_days,
      is_active: true,
    });
    router.back();
  };

  return (
    <TaskForm
      isAdmin={isAdmin}
      defaultGlobal={global === 'true'}
      submitting={createTask.isPending}
      error={error}
      submitLabel="Create Task"
      onSubmit={handleSubmit}
    />
  );
}
