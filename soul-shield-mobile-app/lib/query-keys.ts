export const queryKeys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  tasks: (date: string) => ['tasks', date] as const,
  taskHistory: (from: string, to: string) => ['taskHistory', from, to] as const,
  categoryTasks: (categoryId: number, date: string, page: number) =>
    ['categoryTasks', categoryId, date, page] as const,
};
