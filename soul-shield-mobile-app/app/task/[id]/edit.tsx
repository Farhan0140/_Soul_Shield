import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import type { Task, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { useAuth } from '@/context/auth-context';
import { useUpdateTask } from '@/hooks/queries/use-task-mutations';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { getErrorMessage } from '@/lib/errors';
import { todayISODate } from '@/lib/date';

export default function EditTaskScreen() {
  const { id, task: taskParam } = useLocalSearchParams<{ id: string; task: string }>();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
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
      { id: Number(id), input },
      {
        onSuccess: () => router.back(),
        onError: (err) => setError(getErrorMessage(err)),
      }
    );
    // Offline: the mutation queues silently rather than resolving, so don't
    // leave the form stuck on "saving" — the optimistic patch already applied.
    if (!isOnline) router.back();
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
