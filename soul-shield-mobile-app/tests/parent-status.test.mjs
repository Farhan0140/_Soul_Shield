// Runs the TypeScript computeParentStatus against the SAME fixture file the
// Go implementation is tested with (soul-shield/rest/handlers/task/
// subtask_merge_test.go), so the two ports can't silently drift apart.
// Node 22.18+ runs the .ts import directly (type stripping).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { computeParentStatus } from '../lib/db/parent-status.ts';

const fixture = JSON.parse(
  readFileSync(new URL('../../shared-test-fixtures/parent-status.json', import.meta.url), 'utf8')
);

for (const c of fixture.cases) {
  test(`computeParentStatus: ${c.name}`, () => {
    const subs = c.statuses.map((status) => ({ status }));
    assert.equal(computeParentStatus(subs, c.date, c.today), c.expected);
  });
}
