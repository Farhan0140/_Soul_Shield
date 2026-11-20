/**
 * Sample content for demo mode. Covers every kind of task the app supports:
 * plain check-off tasks, counters (dhikr, push-ups, water), timers (Quran,
 * focus sessions), tasks with mixed sub-tasks (the five daily prayers, a
 * workout), fixed tasks an admin publishes to everyone, and daily / weekly /
 * custom schedules.
 *
 * IDs sit in a high range that real accounts never reach, because some
 * per-task UI state (the running timer) is kept in localStorage by task id.
 *
 * `rate` is how often the task was done on past days in the generated
 * history; `today` is its starting state for the current day.
 */

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

export const DEMO_USER = {
  id: 900000,
  full_name: 'Demo Visitor',
  email: 'visitor@example.com',
  // Admin, so the tour can show the fixed-task management page as well.
  role: 'admin',
};

export const DEMO_CATEGORIES = [
  { id: 900001, name: 'Ibadah', color_hex: '#4D7C0F' },
  { id: 900002, name: 'Health', color_hex: '#EA580C' },
  { id: 900003, name: 'Learning', color_hex: '#0284C7' },
  { id: 900004, name: 'Work', color_hex: '#475569' },
  { id: 900005, name: 'Family', color_hex: '#DB2777' },
];

export const DEMO_TASKS = [
  {
    task_id: 900101,
    title: 'Salat — five daily prayers',
    description: 'Pray each prayer on time, ideally in congregation.',
    category_id: 900001,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'normal',
    reward_text: 'Alhamdulillah — all five prayers done today! 🤍',
    rate: 0.88,
    sub_tasks: [
      { sub_task_id: 900501, title: 'Fajr', task_type: 'normal', today: 'completed' },
      { sub_task_id: 900502, title: 'Dhuhr', task_type: 'normal', today: 'completed' },
      { sub_task_id: 900503, title: 'Asr', task_type: 'normal' },
      { sub_task_id: 900504, title: 'Maghrib', task_type: 'normal' },
      { sub_task_id: 900505, title: 'Isha', task_type: 'normal' },
    ],
  },
  {
    task_id: 900102,
    title: 'Morning dhikr',
    description: 'SubhanAllah ×33, Alhamdulillah ×33, Allahu Akbar ×34.',
    category_id: 900001,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'counter',
    target_count: 100,
    reward_text: 'May Allah accept your dhikr.',
    rate: 0.8,
    today: { progress_count: 33 },
  },
  {
    task_id: 900103,
    title: 'Read Quran',
    description: 'Recite slowly, with reflection on the meaning.',
    category_id: 900001,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'timer',
    duration_seconds: 15 * 60,
    reward_text: 'Every letter counts. Keep going!',
    rate: 0.72,
  },
  {
    task_id: 900104,
    title: 'Workout',
    description: 'A short bodyweight circuit — no equipment needed.',
    category_id: 900002,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'normal',
    reward_text: 'Strong body, strong mind 💪',
    rate: 0.62,
    sub_tasks: [
      { sub_task_id: 900511, title: 'Push-ups', task_type: 'counter', target_count: 10, today: 'completed' },
      { sub_task_id: 900512, title: 'Squats', task_type: 'counter', target_count: 20, today: { progress_count: 8 } },
      {
        sub_task_id: 900513,
        title: 'Plank',
        description: 'Keep your back straight and core tight.',
        task_type: 'timer',
        duration_seconds: 60,
      },
    ],
  },
  {
    task_id: 900105,
    title: 'Drink water',
    description: 'One glass at a time — 8 across the day.',
    category_id: 900002,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'counter',
    target_count: 8,
    rate: 0.7,
    today: { progress_count: 5 },
  },
  {
    task_id: 900106,
    title: 'Evening walk',
    description: '20 minutes outside, phone in pocket.',
    category_id: 900002,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'normal',
    rate: 0.66,
    today: 'completed',
  },
  {
    task_id: 900107,
    title: 'Read 10 pages',
    description: 'Any book that teaches you something.',
    category_id: 900003,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'normal',
    reward_text: 'Ten pages closer to finishing the book 📖',
    rate: 0.6,
  },
  {
    task_id: 900108,
    title: 'Deep work session',
    description: 'One focused block, notifications off.',
    category_id: 900004,
    recurrence_type: 'custom',
    recurrence_days: WEEKDAYS,
    task_type: 'timer',
    duration_seconds: 25 * 60,
    rate: 0.75,
    today: 'completed',
  },
  {
    task_id: 900109,
    title: 'Call parents',
    description: 'Check in and ask how their week went.',
    category_id: 900005,
    recurrence_type: 'weekly',
    recurrence_days: [0, 3],
    task_type: 'normal',
    rate: 0.85,
  },
  {
    task_id: 900110,
    title: 'Surah Al-Kahf',
    description: 'Recited every Friday.',
    category_id: 900001,
    recurrence_type: 'weekly',
    recurrence_days: [5],
    task_type: 'timer',
    duration_seconds: 20 * 60,
    reward_text: 'A light between the two Fridays ✨',
    rate: 0.8,
  },
  {
    task_id: 900111,
    title: 'Gratitude journal',
    description: 'Write down three things you are grateful for.',
    category_id: null,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'normal',
    rate: 0.5,
  },

  // ---- Fixed tasks (published by an admin to every user) ----
  {
    task_id: 900201,
    title: 'Istighfar',
    description: 'Astaghfirullah — 100 times through the day.',
    is_global: true,
    category_id: null,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'counter',
    target_count: 100,
    reward_text: 'Your Lord is Most Forgiving.',
    rate: 0.55,
    today: { progress_count: 20 },
  },
  {
    task_id: 900202,
    title: 'Sleep before 11 pm',
    description: 'Wind down early so Fajr is easier.',
    is_global: true,
    category_id: null,
    recurrence_type: 'daily',
    recurrence_days: ALL_DAYS,
    task_type: 'normal',
    rate: 0.45,
  },
  {
    task_id: 900203,
    title: 'Give sadaqah',
    description: 'Any amount, every Friday.',
    is_global: true,
    category_id: null,
    recurrence_type: 'weekly',
    recurrence_days: [5],
    task_type: 'normal',
    rate: 0.6,
  },
];

/** How many days of past activity the demo starts with. */
export const DEMO_HISTORY_DAYS = 120;

/** Days ago that every task was missed, so the streak looks real (not 120). */
export const DEMO_REST_DAY = 12;

/** Community numbers for the admin page. */
export const DEMO_COMMUNITY = {
  total_users: 248,
  new_users: 31,
  active_today: 87,
  active_users: 164,
};
