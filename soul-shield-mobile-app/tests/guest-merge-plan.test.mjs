// Guest -> account upload (lib/guest-merge.ts): a category made without an
// account folds into the account's same-named category, so the server's
// one-category-per-name rule can't reject the upload.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planGuestCategoryMerge } from '../lib/guest-merge-plan.ts';

const account = (uuid, name) => ({ uuid, name, serverUpdatedAt: '2026-11-01T00:00:00Z' });
const guest = (uuid, name) => ({ uuid, name, serverUpdatedAt: null });

test('a guest category with an account twin is merged into it', () => {
  const plan = planGuestCategoryMerge([account('a1', 'Morning'), guest('g1', 'Morning')]);
  assert.deepEqual([...plan], [['g1', 'a1']]);
});

test('names match case- and whitespace-insensitively', () => {
  const plan = planGuestCategoryMerge([account('a1', 'Morning Adhkar'), guest('g1', '  morning adhkar ')]);
  assert.equal(plan.get('g1'), 'a1');
});

test('a guest category with no twin is left alone (uploaded as new)', () => {
  const plan = planGuestCategoryMerge([account('a1', 'Morning'), guest('g1', 'Evening')]);
  assert.equal(plan.size, 0);
});

test('account categories are never merged away', () => {
  const plan = planGuestCategoryMerge([account('a1', 'Morning'), account('a2', 'morning')]);
  assert.equal(plan.size, 0);
});

test('nothing to merge for a pure guest device', () => {
  assert.equal(planGuestCategoryMerge([guest('g1', 'Morning'), guest('g2', 'Evening')]).size, 0);
});
