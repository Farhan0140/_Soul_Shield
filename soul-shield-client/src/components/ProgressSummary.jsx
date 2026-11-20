import BeadString from './BeadString';

/** The day's progress as a string of prayer beads, with the count beside it. */
export default function ProgressSummary({ tasks, label = "Today's deeds" }) {
  // Only the user's own tasks count - admin-managed fixed tasks (is_global)
  // that haven't been added to "My Tasks" would otherwise inflate the total
  // with things they never chose to track.
  const myTasks = tasks.filter(t => !t.is_global);
  const total = myTasks.length;
  const completed = myTasks.filter(t => t.status === 'completed').length;
  const partial = myTasks.filter(t => t.status === 'partially_completed').length;
  const remaining = total - completed - partial;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const allDone = completed === total && total > 0;

  return (
    <section aria-label={label} className="card overflow-hidden">
      <div className="grid gap-y-2 p-6 sm:p-8 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] lg:items-center lg:gap-x-8">
        <div>
          <p className="text-[13px] text-muted">{label}</p>
          <p className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="display text-[48px] leading-none text-fg sm:text-[56px]">{completed}</span>
            <span className="text-base text-muted">of {total}</span>
          </p>
          <p className="mt-3 text-[13px] text-fg-2">
            {allDone ? 'Every deed done for the day' : `${pct}% done, ${remaining + partial} to go`}
          </p>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted lg:mt-6 lg:block lg:space-y-2">
            <li className="flex items-center gap-2">
              <span className="bead bead-done w-3" aria-hidden="true" />
              <span className="tabular-nums">{completed}</span> completed
            </li>
            {partial > 0 && (
              <li className="flex items-center gap-2">
                <span className="bead bead-part w-3" aria-hidden="true" />
                <span className="tabular-nums">{partial}</span> partly done
              </li>
            )}
            <li className="flex items-center gap-2">
              <span className="bead bead-todo w-3" aria-hidden="true" />
              <span className="tabular-nums">{remaining}</span> not started
            </li>
          </ul>
        </div>

        <BeadString
          total={total}
          completed={completed}
          partial={partial}
          className="-mx-2 mt-2 h-auto w-[calc(100%+16px)] lg:mt-0"
        />
      </div>
    </section>
  );
}
