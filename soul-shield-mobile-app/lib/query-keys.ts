export const queryKeys = {
  me: ['me'] as const,
  categories: ['categories'] as const,
  tasks: (date: string) => ['tasks', date] as const,
  taskHistory: (from: string, to: string) => ['taskHistory', from, to] as const,
};
