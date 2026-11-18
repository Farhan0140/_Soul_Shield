// The account-isolation rule behind lib/local-owner.ts: local data is only
// ever kept for the SAME account that owns it.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideLocalDataAction } from '../lib/local-owner-decision.ts';

test('same user signing back in keeps local data (offline edits survive)', () => {
  assert.equal(decideLocalDataAction('42', '42', true), 'keep');
});

test('a different user signing in wipes the previous user data', () => {
  assert.equal(decideLocalDataAction('42', '7', true), 'wipe');
});

test('a different user is wiped even if the store looks empty', () => {
  // Queued mutations / sync cursor may still belong to the previous user.
  assert.equal(decideLocalDataAction('42', '7', false), 'wipe');
});

test('unknown owner with data present is wiped (never risk mixing accounts)', () => {
  assert.equal(decideLocalDataAction(null, '7', true), 'wipe');
});

test('fresh install (no owner, no data) keeps (nothing to wipe)', () => {
  assert.equal(decideLocalDataAction(null, '7', false), 'keep');
});
