import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import type { TaskInput, TaskUpdateInput } from '@/api/types';
import { TaskForm } from '@/components/task/task-form';
import { useAuth } from '@/context/auth-context';
import { useCreateTask } from '@/hooks/queries/use-task-mutations';
import { getErrorMessage } from '@/lib/errors';

export default function NewTaskScreen() {
  const { global } = useLocalSearchParams<{ global?: string }>();
  const { user } = useAuth();
  const createTask = useCreateTask();
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // TaskForm always emits a fully-populated TaskInput in create mode.
  const handleSubmit = (input: TaskInput | TaskUpdateInput) => {
    setError(null);
    createTask.mutate(input as TaskInput, {
      onSuccess: () => router.back(),
      onError: (err) => setError(getErrorMessage(err)),
    });
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
