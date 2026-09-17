import { getTasks } from '@/api/tasks';
import { deriveTasksForDate } from '@/lib/db/tasks-repo';
import { tokenStore } from '@/lib/secure-store';

/** Dev-only verification for the local-first plan's Phase 3: there's no
 * test runner set up in this project yet, so instead of a real contract
 * test this is a manual diagnostic - compares deriveTasksForDate's
 * on-device recurrence/status derivation against the real GET /tasks?date=
 * response for the same date, for every date in the given range, and
 * reports any mismatch. Wired to a dev-only button in Profile (see
 * app/(tabs)/profile.tsx) rather than a CI test suite - if this project
 * gains a real test framework later, this logic should move there instead.
 *
 * A mismatch here means the TS port in lib/db/tasks-repo.ts has drifted
 * from soul-shield/repo/task.go's ListForDate/ListForRange - the exact risk
 * the plan flagged when choosing full on-device derivation. */
export async function checkDerivedTasksAgainstServer(dates: string[]): Promise<string> {
  const token = await tokenStore.getToken();
  if (!token) return 'Not signed in.';

  const lines: string[] = [];
  let mismatches = 0;

  for (const date of dates) {
    const serverTasks = await getTasks(date, token);
    const derived = deriveTasksForDate(date);

    // The local store doesn't have the server's bigint task_id, only uuid -
    // match by title instead, good enough for a manual diagnostic (this
    // isn't trying to be a real automated test).
    const serverByTitle = new Map(serverTasks.map((t) => [t.title, t] as const));

    if (serverTasks.length !== derived.length) {
      mismatches++;
      lines.push(`${date}: count mismatch - server ${serverTasks.length}, derived ${derived.length}`);
      continue;
    }

    for (const item of derived) {
      const match = serverByTitle.get(item.title);
      if (!match) {
        mismatches++;
        lines.push(`${date}: "${item.title}" not found in server response`);
        continue;
      }
      if (match.status !== item.status) {
        mismatches++;
        lines.push(`${date}: "${item.title}" status mismatch - server ${match.status}, derived ${item.status}`);
      }
    }
  }

  if (mismatches === 0) {
    return `OK - ${dates.length} date(s) checked, all matched.`;
  }
  return `${mismatches} mismatch(es) across ${dates.length} date(s):\n${lines.join('\n')}`;
}
