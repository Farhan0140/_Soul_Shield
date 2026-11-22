/** Groups the admin's fixed tasks by category for the Fixed tasks page
 * (pages/CategoryDetail.jsx), e.g. "Fitness -> its tasks". Presentation
 * only. Groups keep the order their first task appears in; same-named
 * categories share one group; tasks without a category go last (name null).
 * Mirrors the mobile app's lib/group-fixed-tasks.ts. */
export function groupFixedTasksByCategory(tasks) {
  const named = new Map();
  const other = [];
  for (const task of tasks) {
    const name = (task.category_name ?? '').trim();
    if (task.category_id == null || !name) {
      other.push(task);
      continue;
    }
    const key = name.toLowerCase();
    const group = named.get(key);
    if (group) group.tasks.push(task);
    else named.set(key, { key: String(task.category_id), name, color: task.category_color ?? null, tasks: [task] });
  }
  const groups = [...named.values()];
  if (other.length > 0) groups.push({ key: '__none__', name: null, color: null, tasks: other });
  return groups;
}
