/**
 * In-browser stand-in for the SoulShield API, used only in demo mode.
 *
 * Exposes exactly the functions ApiContext provides, with the same arguments
 * and the same response shapes as the Go server (see soul-shield/rest/
 * handlers/task/dto.go), and mirrors its status rules:
 *   - no completion on a past day is "missed", today/future is "pending";
 *   - a counter becomes "completed" once progress reaches its target;
 *   - a task with sub-tasks derives its status from them
 *     (pending / partially_completed / completed).
 *
 * Data lives in sessionStorage for the tab, so a refresh keeps the visitor's
 * changes and closing the tab (or leaving the demo) throws them away. Past
 * activity is generated deterministically, so the history looks lived-in
 * without storing months of rows. Small artificial delays let the UI's
 * loading states show the way they do against the real server.
 */
import {
  DEMO_USER,
  DEMO_CATEGORIES,
  DEMO_TASKS,
  DEMO_HISTORY_DAYS,
  DEMO_REST_DAY,
  DEMO_COMMUNITY,
} from './demoData';
import { DEMO_STORE_KEY } from './demoMode';

const STORE_VERSION = 1;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// ---- Dates (local calendar days, 'YYYY-MM-DD') ------------------------------

const keyOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const todayKey = () => keyOf(new Date());
const addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
const weekday = (key) => parseKey(key).getDay();
const daysBetween = (fromKey, toKey) => Math.round((parseKey(toKey) - parseKey(fromKey)) / 86400000);

// ---- Deterministic pseudo-randomness (FNV-1a -> [0, 1)) -----------------------

function rand(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ---- Errors & latency -----------------------------------------------------------

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  err.raw = { error: message };
  throw err;
}

const DEMO_ONLY =
  "That isn't available in the demo — the demo never touches a real account. Create a free account to use it.";

const wait = (min = 220, max = 480) =>
  new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Wraps a synchronous change so it behaves like a network call. The change
 * (and its sessionStorage save) happens immediately and only the response is
 * delayed: the counter flushes pending taps while the page is closing, and the
 * real API's keepalive request survives that, so the demo's write must not
 * wait on a timer the closing page will never run. */
function mutation(fn, min = 220, max = 480) {
  return async (...args) => {
    let result;
    let error = null;
    try {
      result = fn(...args);
    } catch (err) {
      error = err;
    }
    await wait(min, max);
    if (error) throw error;
    return result;
  };
}

// ---- Store ----------------------------------------------------------------------

function buildStore() {
  const today = todayKey();
  const startKey = addDays(today, -DEMO_HISTORY_DAYS);
  const progress = {};
  const nowIso = new Date().toISOString();

  const seedToday = (key, spec, target) => {
    if (!spec) return;
    if (spec === 'completed') {
      progress[key] = { status: 'completed', progress_count: target || 0, completed_at: nowIso };
    } else {
      const count = spec.progress_count || 0;
      const done = target && count >= target;
      progress[key] = { status: done ? 'completed' : 'pending', progress_count: count, ...(done ? { completed_at: nowIso } : {}) };
    }
  };

  const tasks = DEMO_TASKS.map((t, i) => {
    seedToday(`t${t.task_id}:${today}`, t.today, t.target_count);
    const subs = (t.sub_tasks || []).map((s) => {
      seedToday(`s${s.sub_task_id}:${today}`, s.today, s.target_count);
      return {
        sub_task_id: s.sub_task_id,
        title: s.title,
        description: s.description || null,
        task_type: s.task_type || 'normal',
        target_count: s.target_count ?? null,
        duration_seconds: s.duration_seconds ?? null,
        seeded: true,
      };
    });
    return {
      task_id: t.task_id,
      title: t.title,
      description: t.description || '',
      is_global: !!t.is_global,
      category_id: t.category_id ?? null,
      recurrence_type: t.recurrence_type,
      recurrence_days: t.recurrence_days || ALL_DAYS,
      task_type: t.task_type || 'normal',
      target_count: t.target_count ?? null,
      duration_seconds: t.duration_seconds ?? null,
      reward_text: t.reward_text || null,
      reminder_time: null,
      position: i,
      created_on: startKey,
      source_task_id: null,
      rate: t.rate ?? 0.6,
      seeded: true,
      sub_tasks: subs,
    };
  });

  return {
    version: STORE_VERSION,
    seededOn: today,
    startKey,
    nextId: 910000,
    categories: DEMO_CATEGORIES.map((c, i) => ({ ...c, uuid: `demo-category-${c.id}`, position: i })),
    tasks,
    progress,
  };
}

let store = null;

function db() {
  if (store) return store;
  try {
    const saved = JSON.parse(sessionStorage.getItem(DEMO_STORE_KEY) || 'null');
    if (saved && saved.version === STORE_VERSION) store = saved;
  } catch {
    /* unreadable or blocked: start fresh */
  }
  if (!store) {
    store = buildStore();
    save();
  }
  return store;
}

function save() {
  try {
    sessionStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage blocked/full: the demo still works for this page load */
  }
}

const nextId = () => {
  const s = db();
  s.nextId += 1;
  return s.nextId;
};

// ---- Status derivation ------------------------------------------------------------

/** Generated outcome for a day before the demo started. */
function generated(seedKey, rate, date, target) {
  const s = db();
  const daysAgo = daysBetween(date, s.seededOn);
  let p = rate;
  if (daysAgo <= 14) p = Math.min(0.97, rate + 0.1); // a better recent fortnight
  const done = daysAgo !== DEMO_REST_DAY && rand(`${seedKey}:${date}`) < p;
  if (done) {
    const at = parseKey(date);
    at.setHours(6 + Math.floor(rand(`${seedKey}:${date}:h`) * 15), Math.floor(rand(`${seedKey}:${date}:m`) * 60));
    return { status: 'completed', progress_count: target || 0, completed_at: at.toISOString() };
  }
  const partial = target ? Math.floor(target * rand(`${seedKey}:${date}:p`) * 0.9) : 0;
  return { status: 'missed', progress_count: partial };
}

function resolveState(key, seedKey, rate, seeded, date, target) {
  const s = db();
  const today = todayKey();
  const explicit = s.progress[key];
  if (explicit) {
    return explicit.status === 'pending' && date < today ? { ...explicit, status: 'missed' } : explicit;
  }
  if (seeded && date < s.seededOn) return generated(seedKey, rate, date, target);
  return { status: date < today ? 'missed' : 'pending', progress_count: 0 };
}

const taskState = (task, date) =>
  resolveState(`t${task.task_id}:${date}`, `t${task.task_id}`, task.rate, task.seeded, date, task.target_count);

const subState = (task, sub, date) =>
  resolveState(
    `s${sub.sub_task_id}:${date}`,
    `s${sub.sub_task_id}`,
    // Each sub-task is done a little less reliably than its parent's average.
    Math.max(0.25, task.rate - 0.08 + rand(`r${sub.sub_task_id}`) * 0.16),
    sub.seeded,
    date,
    sub.target_count
  );

function parentStatus(subs, date) {
  const done = subs.filter((s) => s.status === 'completed').length;
  if (done === subs.length) return 'completed';
  if (done > 0) return 'partially_completed';
  return date < todayKey() ? 'missed' : 'pending';
}

const isAdded = (globalTask) => db().tasks.some((t) => t.source_task_id === globalTask.task_id);

function isScheduled(task, date) {
  return task.created_on <= date && (task.recurrence_days || ALL_DAYS).includes(weekday(date));
}

/** One task on one day, in the server's TaskWithStatusResponse shape. */
function withStatus(task, date) {
  const s = db();
  const category = task.category_id != null ? s.categories.find((c) => c.id === task.category_id) : null;

  const subs = (task.sub_tasks || []).map((sub) => {
    const st = subState(task, sub, date);
    const out = {
      sub_task_id: sub.sub_task_id,
      sub_task_uuid: `demo-subtask-${sub.sub_task_id}`,
      title: sub.title,
      task_type: sub.task_type,
      progress_count: st.progress_count || 0,
      status: st.status,
    };
    if (sub.description) out.description = sub.description;
    if (sub.task_type === 'counter') out.target_count = sub.target_count;
    if (sub.task_type === 'timer') out.duration_seconds = sub.duration_seconds;
    if (st.completed_at) out.completed_at = st.completed_at;
    return out;
  });

  let state;
  if (subs.length) {
    const status = parentStatus(subs, date);
    const last = subs.map((x) => x.completed_at).filter(Boolean).sort().pop();
    state = { status, progress_count: 0, ...(status === 'completed' && last ? { completed_at: last } : {}) };
  } else {
    state = taskState(task, date);
  }

  const out = {
    task_id: task.task_id,
    task_uuid: `demo-task-${task.task_id}`,
    title: task.title,
    description: task.description || '',
    is_global: task.is_global,
    recurrence_type: task.recurrence_type,
    date,
    status: state.status,
    task_type: task.task_type,
    progress_count: state.progress_count || 0,
    recurrence_days: task.recurrence_days,
    position: task.position,
    already_added: task.is_global ? isAdded(task) : false,
  };
  if (state.completed_at) out.completed_at = state.completed_at;
  if (category) {
    out.category_id = category.id;
    out.category_uuid = category.uuid;
    out.category_name = category.name;
    out.category_color = category.color_hex;
  }
  if (task.reward_text) out.reward_text = task.reward_text;
  if (task.task_type === 'counter') out.target_count = task.target_count;
  if (task.task_type === 'timer') out.duration_seconds = task.duration_seconds;
  if (task.reminder_time) out.reminder_time = task.reminder_time;
  if (subs.length) out.sub_tasks = subs;
  return out;
}

function listForDate(date) {
  return db()
    .tasks.filter((t) => isScheduled(t, date))
    .sort((a, b) => a.position - b.position)
    .map((t) => withStatus(t, date));
}

function historyBetween(fromKey, toKey) {
  const s = db();
  const from = fromKey < s.startKey ? s.startKey : fromKey;
  const to = toKey > todayKey() ? todayKey() : toKey;
  const items = [];
  for (let d = from; d <= to; d = addDays(d, 1)) items.push(...listForDate(d));
  return items;
}

// ---- Lookups & guards ---------------------------------------------------------------

function findTask(id) {
  const task = db().tasks.find((t) => t.task_id === Number(id));
  if (!task) fail(404, "We looked everywhere, but couldn't find that task.");
  return task;
}

function assertActionable(task, date) {
  if (date > todayKey()) fail(400, "You can't record progress for a day that hasn't happened yet.");
  if (!isScheduled(task, date)) fail(400, "This task isn't scheduled for that day.");
}

function validCategoryId(value) {
  if (value === undefined) return undefined;
  if (value === null || Number(value) === 0) return null;
  const id = Number(value);
  if (!db().categories.some((c) => c.id === id)) fail(400, "That category doesn't exist anymore.");
  return id;
}

function validateTaskFields(type, target, duration) {
  if (type === 'counter' && !(Number(target) >= 1)) fail(400, 'Counter tasks need a target count of at least 1.');
  if (type === 'timer' && !(Number(duration) >= 1)) fail(400, 'Timer tasks need a duration.');
}

function buildSubTasks(list, existing = []) {
  return (list || []).map((s) => {
    const type = s.task_type || 'normal';
    validateTaskFields(type, s.target_count, s.duration_seconds);
    if (!s.title || !s.title.trim()) fail(400, 'Every sub-task needs a title.');
    const kept = s.id != null ? existing.find((e) => e.sub_task_id === Number(s.id)) : null;
    return {
      sub_task_id: kept ? kept.sub_task_id : nextId(),
      title: s.title.trim(),
      description: s.description || null,
      task_type: type,
      target_count: type === 'counter' ? Number(s.target_count) : null,
      duration_seconds: type === 'timer' ? Number(s.duration_seconds) : null,
      seeded: kept ? kept.seeded : false,
    };
  });
}

function completionResponse(task, date, state) {
  const out = {
    id: Number(`${task.task_id}`.slice(-4) + date.replaceAll('-', '').slice(-4)),
    task_id: task.task_id,
    task_title: task.title,
    date,
    status: state.status,
    progress_count: state.progress_count || 0,
  };
  if (state.completed_at) out.completed_at = state.completed_at;
  if (state.status === 'completed' && task.reward_text) out.reward_text = task.reward_text;
  return out;
}

function subCompletionResponse(task, sub, date) {
  const view = withStatus(task, date);
  const subView = view.sub_tasks.find((x) => x.sub_task_id === sub.sub_task_id);
  const out = {
    id: sub.sub_task_id,
    sub_task_id: sub.sub_task_id,
    parent_task_id: task.task_id,
    sub_task_title: sub.title,
    date,
    status: subView.status,
    progress_count: subView.progress_count,
    parent_status: view.status,
  };
  if (subView.completed_at) out.completed_at = subView.completed_at;
  if (view.status === 'completed' && task.reward_text) out.parent_reward_text = task.reward_text;
  return out;
}

function findSub(task, subTaskId) {
  const sub = (task.sub_tasks || []).find((s) => s.sub_task_id === Number(subTaskId));
  if (!sub) fail(404, "We looked everywhere, but couldn't find that sub-task.");
  return sub;
}

// ---- Categories -------------------------------------------------------------------------

function checkCategory(name, color, exceptId) {
  const clean = (name || '').trim();
  if (clean.length < 1) fail(400, 'Every category needs a name.');
  if (!/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(color || '')) fail(400, "That doesn't look like a valid color code.");
  const dup = db().categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === clean.toLowerCase());
  if (dup) fail(409, 'You already have a category with that name — try a different one.');
  return clean;
}

const publicCategory = (c) => ({ id: c.id, uuid: c.uuid, name: c.name, color_hex: c.color_hex, position: c.position });

async function getCategories() {
  await wait();
  return clone([...db().categories].sort((a, b) => a.position - b.position).map(publicCategory));
}

function createCategory(name, color_hex) {
  const s = db();
  const clean = checkCategory(name, color_hex);
  const id = nextId();
  const category = {
    id,
    uuid: `demo-category-${id}`,
    name: clean,
    color_hex: color_hex.toUpperCase(),
    position: s.categories.length,
  };
  s.categories.push(category);
  save();
  return clone(publicCategory(category));
}

function updateCategory(id, name, color_hex) {
  const category = db().categories.find((c) => c.id === Number(id));
  if (!category) fail(404, "We looked everywhere, but couldn't find that category.");
  category.name = checkCategory(name, color_hex, category.id);
  category.color_hex = color_hex.toUpperCase();
  save();
  return clone(publicCategory(category));
}

function deleteCategory(id) {
  const s = db();
  const before = s.categories.length;
  s.categories = s.categories.filter((c) => c.id !== Number(id));
  if (s.categories.length === before) fail(404, "We looked everywhere, but couldn't find that category.");
  // Its tasks become Uncategorized, they aren't deleted.
  s.tasks.forEach((t) => {
    if (t.category_id === Number(id)) t.category_id = null;
  });
  save();
  return { message: 'Category deleted successfully' };
}

// ---- Tasks ---------------------------------------------------------------------------------

async function getTasks(dateStr) {
  await wait();
  return clone(listForDate(dateStr));
}

async function getTasksHistory(fromStr, toStr) {
  await wait(320, 620);
  return clone(historyBetween(fromStr, toStr));
}

function createTask(payload = {}) {
  const s = db();
  const title = (payload.title || '').trim();
  if (!title) fail(400, 'Every task needs a title.');
  const type = payload.task_type || 'normal';
  validateTaskFields(type, payload.target_count, payload.duration_seconds);
  const recurrenceType = payload.recurrence_type || 'daily';
  const days = recurrenceType === 'daily' ? ALL_DAYS : payload.recurrence_days || [];
  if (!days.length) fail(400, 'Pick at least one day for this task to repeat on.');

  const task = {
    task_id: nextId(),
    title,
    description: payload.description || '',
    is_global: !!payload.is_global,
    category_id: validCategoryId(payload.category_id) ?? null,
    recurrence_type: recurrenceType,
    recurrence_days: [...days].sort(),
    task_type: type,
    target_count: type === 'counter' ? Number(payload.target_count) : null,
    duration_seconds: type === 'timer' ? Number(payload.duration_seconds) : null,
    reward_text: payload.reward_text || null,
    reminder_time: payload.reminder_time || null,
    position: Math.max(-1, ...s.tasks.map((t) => t.position)) + 1,
    created_on: todayKey(),
    source_task_id: null,
    rate: 0.6,
    seeded: false,
    sub_tasks: buildSubTasks(payload.sub_tasks),
  };
  s.tasks.push(task);
  save();
  return clone({ id: task.task_id, ...withStatus(task, todayKey()) });
}

function updateTask(id, payload = {}) {
  const task = findTask(id);

  const type = payload.task_type ?? task.task_type;
  const target = payload.target_count ?? task.target_count;
  const duration = payload.duration_seconds ?? task.duration_seconds;
  validateTaskFields(type, target, duration);

  if (payload.title !== undefined) {
    if (!payload.title.trim()) fail(400, 'Every task needs a title.');
    task.title = payload.title.trim();
  }
  if (payload.description !== undefined) task.description = payload.description || '';
  // Like the server: omitted leaves it as is, 0 clears it.
  const category = validCategoryId(payload.category_id);
  if (category !== undefined) task.category_id = category;
  if (payload.recurrence_type !== undefined) task.recurrence_type = payload.recurrence_type;
  if (payload.recurrence_days !== undefined) {
    const days = task.recurrence_type === 'daily' ? ALL_DAYS : payload.recurrence_days;
    if (!days.length) fail(400, 'Pick at least one day for this task to repeat on.');
    task.recurrence_days = [...days].sort();
  }
  if (payload.is_global !== undefined) task.is_global = !!payload.is_global;
  if (payload.reward_text !== undefined) task.reward_text = payload.reward_text || null;
  if (payload.reminder_time !== undefined) task.reminder_time = payload.reminder_time || null;
  task.task_type = type;
  task.target_count = type === 'counter' ? Number(target) : null;
  task.duration_seconds = type === 'timer' ? Number(duration) : null;
  if (Array.isArray(payload.sub_tasks)) task.sub_tasks = buildSubTasks(payload.sub_tasks, task.sub_tasks);

  save();
  return clone({ id: task.task_id, ...withStatus(task, todayKey()) });
}

function deleteTask(id) {
  const s = db();
  const task = findTask(id);
  s.tasks = s.tasks.filter((t) => t !== task);
  save();
  return { message: 'Task deleted successfully' };
}

function incrementCounter(taskId, dateStr, incrementValue) {
  const task = findTask(taskId);
  assertActionable(task, dateStr);
  if (task.task_type !== 'counter') fail(400, 'Only counter tasks can be counted.');
  const amount = Number(incrementValue);
  if (!(amount > 0)) fail(400, 'amount must be greater than 0');

  const current = taskState(task, dateStr);
  const progress = (current.progress_count || 0) + amount;
  const done = current.status === 'completed' || progress >= task.target_count;
  const next = {
    status: done ? 'completed' : 'pending',
    progress_count: progress,
    ...(done ? { completed_at: current.completed_at || new Date().toISOString() } : {}),
  };
  db().progress[`t${task.task_id}:${dateStr}`] = next;
  save();
  return clone(completionResponse(task, dateStr, next));
}

function completeTask(taskId, dateStr) {
  const task = findTask(taskId);
  assertActionable(task, dateStr);
  if (task.sub_tasks?.length) fail(400, 'Tasks with sub-tasks are completed through their sub-tasks.');
  const current = taskState(task, dateStr);
  const next = {
    status: 'completed',
    progress_count: Math.max(current.progress_count || 0, task.target_count || 0),
    completed_at: current.completed_at || new Date().toISOString(),
  };
  db().progress[`t${task.task_id}:${dateStr}`] = next;
  save();
  return clone(completionResponse(task, dateStr, next));
}

function uncompleteTask(taskId, dateStr) {
  const task = findTask(taskId);
  assertActionable(task, dateStr);
  const next = { status: 'pending', progress_count: 0 };
  db().progress[`t${task.task_id}:${dateStr}`] = next;
  save();
  return clone(completionResponse(task, dateStr, next));
}

function addTaskToMyTasks(taskId) {
  const s = db();
  const source = findTask(taskId);
  if (!source.is_global) fail(400, 'Only fixed tasks can be added to your own tasks.');
  const existing = s.tasks.find((t) => t.source_task_id === source.task_id);
  if (existing) return { id: existing.task_id, already_added: true };

  const copy = {
    ...clone(source),
    task_id: nextId(),
    is_global: false,
    position: Math.max(-1, ...s.tasks.map((t) => t.position)) + 1,
    created_on: todayKey(),
    source_task_id: source.task_id,
    seeded: false,
    sub_tasks: (source.sub_tasks || []).map((sub) => ({ ...sub, sub_task_id: nextId(), seeded: false })),
  };
  s.tasks.push(copy);
  save();
  return { id: copy.task_id, already_added: false };
}

function completeSubTask(taskId, subTaskId, dateStr) {
  const task = findTask(taskId);
  const sub = findSub(task, subTaskId);
  assertActionable(task, dateStr);
  const current = subState(task, sub, dateStr);
  db().progress[`s${sub.sub_task_id}:${dateStr}`] = {
    status: 'completed',
    progress_count: Math.max(current.progress_count || 0, sub.target_count || 0),
    completed_at: current.completed_at || new Date().toISOString(),
  };
  save();
  return clone(subCompletionResponse(task, sub, dateStr));
}

function incrementSubTask(taskId, subTaskId, dateStr, incrementValue) {
  const task = findTask(taskId);
  const sub = findSub(task, subTaskId);
  assertActionable(task, dateStr);
  if (sub.task_type !== 'counter') fail(400, 'Only counter sub-tasks can be counted.');
  const amount = Number(incrementValue);
  if (!(amount > 0)) fail(400, 'amount must be greater than 0');

  const current = subState(task, sub, dateStr);
  const progress = (current.progress_count || 0) + amount;
  const done = current.status === 'completed' || progress >= sub.target_count;
  db().progress[`s${sub.sub_task_id}:${dateStr}`] = {
    status: done ? 'completed' : 'pending',
    progress_count: progress,
    ...(done ? { completed_at: current.completed_at || new Date().toISOString() } : {}),
  };
  save();
  return clone(subCompletionResponse(task, sub, dateStr));
}

function uncompleteSubTask(taskId, subTaskId, dateStr) {
  const task = findTask(taskId);
  const sub = findSub(task, subTaskId);
  assertActionable(task, dateStr);
  db().progress[`s${sub.sub_task_id}:${dateStr}`] = { status: 'pending', progress_count: 0 };
  save();
  return clone(subCompletionResponse(task, sub, dateStr));
}

// ---- Stats ----------------------------------------------------------------------------------

async function getPersonalStats(days = 365) {
  await wait(300, 560);
  const today = todayKey();
  const items = historyBetween(addDays(today, -(days - 1)), today);
  const completed = items.filter((t) => t.status === 'completed');

  const doneByDay = new Set(completed.map((t) => t.date));
  let streak = 0;
  let cursor = doneByDay.has(today) ? today : addDays(today, -1);
  while (doneByDay.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const byCategory = {};
  const byWeekday = Array(7).fill(0);
  completed.forEach((t) => {
    if (t.category_name) byCategory[t.category_name] = (byCategory[t.category_name] || 0) + 1;
    byWeekday[weekday(t.date)] += 1;
  });
  const [favorite, favoriteCount] = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const best = completed.length ? byWeekday.indexOf(Math.max(...byWeekday)) : null;

  const out = {
    days,
    total_tasks: items.length,
    total_completed: completed.length,
    completion_rate: items.length ? Math.round((completed.length / items.length) * 100) : 0,
    streak,
    favorite_category_count: favoriteCount,
  };
  if (favorite) out.favorite_category = favorite;
  if (best !== null) out.best_weekday = best;
  return out;
}

async function getAdminStats(days = 30) {
  await wait(300, 560);
  const today = todayKey();
  const active = DEMO_COMMUNITY.active_users;
  const tasks = db()
    .tasks.filter((t) => t.is_global)
    .map((t) => {
      let scheduled = 0;
      for (let d = addDays(today, -(days - 1)); d <= today; d = addDays(d, 1)) {
        if (isScheduled(t, d)) scheduled += 1;
      }
      const opportunities = scheduled * active;
      const completions = Math.round(opportunities * t.rate * (0.8 + rand(`a${t.task_id}`) * 0.2));
      const users = Math.round(active * (0.55 + rand(`u${t.task_id}`) * 0.4));
      return {
        task_id: t.task_id,
        title: t.title,
        completions,
        opportunities,
        completion_rate: opportunities ? Math.round((completions / opportunities) * 100) : 0,
        users,
        added_by: Math.round(users * 0.3 * rand(`b${t.task_id}`)) + (isAdded(t) ? 1 : 0),
      };
    });
  return { days, ...DEMO_COMMUNITY, tasks };
}

// ---- Account -----------------------------------------------------------------------------------

async function getMe() {
  await wait(80, 160);
  return clone(DEMO_USER);
}

async function demoOnly() {
  await wait();
  fail(403, DEMO_ONLY);
}

/** Same keys as the real API value in ApiContext. */
export const demoApi = {
  getCategories,
  createCategory: mutation(createCategory),
  updateCategory: mutation(updateCategory),
  deleteCategory: mutation(deleteCategory),
  getTasks,
  getTasksHistory,
  createTask: mutation(createTask, 300, 560),
  updateTask: mutation(updateTask, 300, 560),
  deleteTask: mutation(deleteTask),
  incrementCounter: mutation(incrementCounter, 120, 260),
  completeTask: mutation(completeTask),
  addTaskToMyTasks: mutation(addTaskToMyTasks),
  completeSubTask: mutation(completeSubTask),
  incrementSubTask: mutation(incrementSubTask, 120, 260),
  uncompleteTask: mutation(uncompleteTask),
  uncompleteSubTask: mutation(uncompleteSubTask),
  getPersonalStats,
  getAdminStats,
  registerUser: demoOnly,
  verifySecurityAnswer: demoOnly,
  resetPassword: demoOnly,
  getMe,
  loginUser: demoOnly,
  changePassword: demoOnly,
  deleteAccount: demoOnly,
};
