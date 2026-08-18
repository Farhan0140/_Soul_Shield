import { m } from 'framer-motion';

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'missed',    label: 'Missed' },
];

/** Status-only now — category is no longer a chip filter narrowing one flat
 * list, since the dashboard shows a collapsed row per category instead
 * (see CategoryRow.jsx/Dashboard.jsx); browsing into a category row already
 * does what a category chip used to, so keeping both would be redundant. */
export default function FilterRow({ activeStatus, setActiveStatus }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-bg rounded-xl w-fit">
      {STATUS_TABS.map(tab => (
        <m.button
          key={tab.key}
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveStatus(tab.key)}
          className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
            ${activeStatus === tab.key ? 'text-white' : 'text-muted hover:text-fg'}`}
        >
          {activeStatus === tab.key && (
            <m.div
              layoutId="status-pill"
              className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative">{tab.label}</span>
        </m.button>
      ))}
    </div>
  );
}