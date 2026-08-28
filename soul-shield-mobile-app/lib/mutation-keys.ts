/** Mutation identity shared between the live hooks (hooks/queries/*) and the
 * stable defaults registered in lib/mutation-defaults.ts — must match
 * exactly, since a mutation paused offline and replayed after an app restart
 * only carries its mutationKey + serialized variables, not the original
 * closure. Kept in its own leaf file (no imports) so lib/task-cache-refresh.ts
 * can read it without creating an import cycle with lib/mutation-defaults.ts,
 * which itself needs to call into task-cache-refresh.ts. */
export const mutationKeys = {
  tasks: {
    create: ['tasks', 'create'] as const,
    update: ['tasks', 'update'] as const,
    delete: ['tasks', 'delete'] as const,
    complete: ['tasks', 'complete'] as const,
    increment: ['tasks', 'increment'] as const,
    completeSubTask: ['tasks', 'completeSubTask'] as const,
    incrementSubTask: ['tasks', 'incrementSubTask'] as const,
    addToMyTasks: ['tasks', 'addToMyTasks'] as const,
  },
  categories: {
    create: ['categories', 'create'] as const,
    update: ['categories', 'update'] as const,
    delete: ['categories', 'delete'] as const,
  },
};
