import SegmentedControl from './ui/SegmentedControl';

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'missed',    label: 'Missed' },
];

/** Status-only now — category is no longer a chip filter narrowing one flat
 * list, since the dashboard shows a collapsed row per category instead
 * (see CategoryRow.jsx/Dashboard.jsx); browsing into a category row already
 * does what a category chip used to, so keeping both would be redundant.
 * `counts` (optional) shows how many tasks each tab holds. */
export default function FilterRow({ activeStatus, setActiveStatus, counts }) {
  return (
    <SegmentedControl
      ariaLabel="Filter tasks by status"
      value={activeStatus}
      onChange={setActiveStatus}
      options={STATUS_TABS.map((tab) => ({ value: tab.key, label: tab.label, count: counts?.[tab.key] }))}
    />
  );
}
