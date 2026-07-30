import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { TaskInput, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { useAuth } from '@/context/auth-context';
import { useCreateTask } from '@/hooks/queries/use-task-mutations';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getErrorMessage } from '@/lib/errors';
import { scheduleTaskReminders } from '@/lib/notifications';

export default function NewTaskScreen() {
  const { global } = useLocalSearchParams<{ global?: string }>();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const createTask = useCreateTask();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // TaskForm always emits a fully-populated TaskInput in create mode.
  const handleSubmit = (input: TaskInput | TaskUpdateInput) => {
    setError(null);
    const fullInput = input as TaskInput;
    createTask.mutate(fullInput, {
      onSuccess: (data) => {
        scheduleTaskReminders({
          task_id: data.id,
          title: fullInput.title,
          reminder_time: fullInput.reminder_time,
          recurrence_days: fullInput.recurrence_days,
          is_active: true,
        });
        router.back();
      },
      onError: (err) => setError(getErrorMessage(err)),
    });
    // Offline: the mutation queues silently rather than resolving, so don't
    // leave the form stuck on "saving" — it'll sync automatically once online.
    if (!isOnline) router.back();
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
