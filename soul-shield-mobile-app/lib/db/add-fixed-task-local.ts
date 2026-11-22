import type { AddToMyTasksResponse, TaskType } from '@/api/types';
import { getGlobalCategoryRef } from '@/lib/background-sync/pull-global';
import { createCategoryLocal, listActiveCategories } from '@/lib/db/categories-repo';
import { decodeIntArray } from '@/lib/db/json-array';
import { listActiveSubTasksByParents, replaceSubTasksForParentLocal } from '@/lib/db/sub-tasks-repo';
import { createTaskLocal, getTaskByUuid, listAllOwnedTasksFlat } from '@/lib/db/tasks-repo';
import { newUuid } from '@/lib/db/uuid';

/**
 * "Add to my tasks" for someone using the app WITHOUT an account: copies a
 * fixed task into their own tasks on the device. It is the local twin of the
 * server's add-to-my-tasks (soul-shield/rest/handlers/task/add_to_my_tasks.go),
 * which signed-in users keep using:
 *   - already added (same source task, or same title) -> nothing new,
 *   - the copy goes into the user's category with the same name as the fixed
 *     task's category (created if missing),
 *   - sub-tasks are copied too.
 * Everything is written unsynced, so it is uploaded with the rest of the
 * guest's data if they sign in later.
 */
export async function addFixedTaskToMyTasksLocal(sourceTaskUuid: string): Promise<AddToMyTasksResponse> {
  const source = getTaskByUuid(sourceTaskUuid);
  if (!source || !source.isGlobal || !source.isActive || source.deletedAt) {
    throw new Error('This fixed task is no longer available.');
  }

  const titleKey = source.title.trim().toLowerCase();
  const existing = listAllOwnedTasksFlat().find(
    (t) => t.sourceTaskUuid === sourceTaskUuid || t.title.trim().toLowerCase() === titleKey
  );
  if (existing) {
    const category = existing.categoryUuid
      ? listActiveCategories().find((c) => c.uuid === existing.categoryUuid)
      : undefined;
    return {
      already_added: true,
      task_id: 0,
      task_uuid: existing.uuid,
      category_uuid: category?.uuid,
      category_name: category?.name,
    };
  }

  let categoryUuid: string | null = null;
  let categoryName: string | undefined;
  const ref = await getGlobalCategoryRef(source.categoryUuid);
  if (ref) {
    const match = listActiveCategories().find((c) => c.name.trim().toLowerCase() === ref.name.trim().toLowerCase());
    if (match) {
      categoryUuid = match.uuid;
      categoryName = match.name;
    } else {
      const created = createCategoryLocal(newUuid(), { name: ref.name, colorHex: ref.colorHex });
      categoryUuid = created?.uuid ?? null;
      categoryName = created?.name;
    }
  }

  const taskUuid = newUuid();
  createTaskLocal(taskUuid, {
    title: source.title,
    description: source.description,
    recurrenceType: source.recurrenceType,
    recurrenceDays: decodeIntArray(source.recurrenceDays),
    categoryUuid,
    rewardText: source.rewardText,
    taskType: source.taskType,
    targetCount: source.targetCount,
    durationSeconds: source.durationSeconds,
    reminderTime: source.reminderTime,
    sourceTaskUuid,
  });

  const sourceSubTasks = listActiveSubTasksByParents([sourceTaskUuid]).get(sourceTaskUuid) ?? [];
  if (sourceSubTasks.length > 0) {
    replaceSubTasksForParentLocal(
      taskUuid,
      sourceSubTasks.map((s) => ({
        title: s.title,
        description: s.description,
        task_type: s.taskType as TaskType,
        target_count: s.targetCount ?? undefined,
        duration_seconds: s.durationSeconds ?? undefined,
      }))
    );
  }

  return {
    already_added: false,
    task_id: 0,
    task_uuid: taskUuid,
    category_uuid: categoryUuid ?? undefined,
    category_name: categoryName,
  };
}
