/**
 * Groups the admin's fixed tasks by category for the Fixed Tasks page
 * (app/category/[id].tsx): "Fitness -> its tasks", "Health -> its tasks"...
 * Presentation only - the tasks themselves are untouched.
 *
 * Pure (no React/Expo imports) so tests/group-fixed-tasks.test.mjs can run it
 * under plain Node.
 */

export interface FixedTaskLike {
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
}

export interface CategoryRefLike {
  name: string;
  colorHex: string;
}

export interface FixedTaskGroup<T> {
  /** Category uuid, or null for fixed tasks without a (known) category. */
  key: string | null;
  name: string | null;
  color: string | null;
  tasks: T[];
}

/**
 * The name/colour comes from the task itself when the category is in this
 * phone's own data (e.g. the admin's phone), otherwise from the fixed-task
 * category list the public pull saves (lib/background-sync/pull-global.ts).
 * Groups keep the order their first task appears in (tasks arrive in the
 * admin's order); same-named categories are shown as one group; tasks with
 * no category (or an unknown one) go into one unnamed group at the end.
 */
export function groupFixedTasksByCategory<T extends FixedTaskLike>(
  tasks: T[],
  refs: Record<string, CategoryRefLike>,
): FixedTaskGroup<T>[] {
  const named = new Map<string, FixedTaskGroup<T>>();
  const other: T[] = [];

  for (const task of tasks) {
    const ref = task.category_id ? refs[task.category_id] : undefined;
    const name = (task.category_name ?? ref?.name ?? '').trim();
    if (!task.category_id || !name) {
      other.push(task);
      continue;
    }
    const nameKey = name.toLowerCase();
    const group = named.get(nameKey);
    if (group) {
      group.tasks.push(task);
    } else {
      named.set(nameKey, {
        key: task.category_id,
        name,
        color: task.category_color ?? ref?.colorHex ?? null,
        tasks: [task],
      });
    }
  }

  const groups = [...named.values()];
  if (other.length > 0) groups.push({ key: null, name: null, color: null, tasks: other });
  return groups;
}
