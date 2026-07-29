import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';

import type { Task, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { useAuth } from '@/context/auth-context';
import { useUpdateTask } from '@/hooks/queries/use-task-mutations';
import { getErrorMessage } from '@/lib/errors';

export default function EditTaskScreen() {
  const { id, task: taskParam } = useLocalSearchParams<{ id: string; task: string }>();
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const [error, setError] = useState<string | null>(null);

  const initialTask = useMemo<Task | undefined>(() => {
    try {
      return taskParam ? (JSON.parse(taskParam) as Task) : undefined;
    } catch {
      return undefined;
    }
  }, [taskParam]);

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
