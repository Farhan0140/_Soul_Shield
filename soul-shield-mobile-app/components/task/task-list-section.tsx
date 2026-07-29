import { StyleSheet, View } from 'react-native';

import type { Task } from '@/api/types';
import { ThemedText } from '@/components/themed-text';
import { TaskCard } from '@/components/task/task-card';

interface TaskListSectionProps {
  title: string;
  tasks: Task[];
  date: string;
  canManage: boolean;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskListSection({
  title,
  tasks,
  date,
  canManage,
  onToggleComplete,
  onEdit,
  onDelete,
}: TaskListSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle" style={styles.heading}>
        {title}
      </ThemedText>
      <View style={styles.list}>
        {tasks.map((task) => (
          <TaskCard
            key={task.task_id}
            task={task}
            date={date}
            canManage={canManage}
            onToggleComplete={() => onToggleComplete(task)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 18 },
  list: { gap: 12 },
});
