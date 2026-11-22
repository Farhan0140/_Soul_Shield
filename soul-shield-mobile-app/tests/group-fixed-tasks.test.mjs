// Fixed Tasks page: admin tasks grouped by category (lib/group-fixed-tasks.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupFixedTasksByCategory } from '../lib/group-fixed-tasks.ts';

const task = (title, category_id, category_name = null, category_color = null) => ({
  title,
  category_id,
  category_name,
  category_color,
});

const summary = (groups) => groups.map((g) => [g.name, g.tasks.map((t) => t.title)]);

test('groups by category in first-seen order, uncategorized last', () => {
  const groups = groupFixedTasksByCategory(
    [
      task('Run', 'c-fit', 'Fitness'),
      task('Loose', null),
      task('Plan day', 'c-prod', 'Productivity'),
      task('Pushups', 'c-fit', 'Fitness'),
      task('Water', 'c-health', 'Health'),
    ],
    {},
  );
  assert.deepEqual(summary(groups), [
    ['Fitness', ['Run', 'Pushups']],
    ['Productivity', ['Plan day']],
    ['Health', ['Water']],
    [null, ['Loose']],
  ]);
});

test('names come from the saved fixed-task categories when the task has none', () => {
  const groups = groupFixedTasksByCategory([task('Run', 'c-fit'), task('Mystery', 'c-gone')], {
    'c-fit': { name: 'Fitness', colorHex: '#ff0000' },
  });
  assert.deepEqual(summary(groups), [
    ['Fitness', ['Run']],
    [null, ['Mystery']],
  ]);
  assert.equal(groups[0].color, '#ff0000');
});

test('same-named categories become one group; nothing is dropped', () => {
  const input = [task('A', 'c1', 'Health'), task('B', 'c2', ' health '), task('C', null)];
  const groups = groupFixedTasksByCategory(input, {});
  assert.deepEqual(summary(groups), [
    ['Health', ['A', 'B']],
    [null, ['C']],
  ]);
  assert.equal(groups.reduce((n, g) => n + g.tasks.length, 0), input.length);
  assert.deepEqual(groupFixedTasksByCategory([], {}), []);
});
