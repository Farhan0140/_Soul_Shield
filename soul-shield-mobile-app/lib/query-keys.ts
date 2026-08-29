export const queryKeys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  tasks: (date: string) => ['tasks', date] as const,
  taskHistory: (from: string, to: string) => ['taskHistory', from, to] as const,
  /** Every personal task, unfiltered by date — see api/tasks.ts's getMyTasks
   * and app/reorder/*'s dedicated drag-and-drop pages. */
  myTasks: ['myTasks'] as const,
};
