import { m } from 'framer-motion';
import { Filter } from 'lucide-react';

const STATUS_TABS = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'missed',    label: 'Missed' },
];

export default function FilterRow({ categories, activeCategory, setActiveCategory, activeStatus, setActiveStatus }) {
  return (
    <div className="space-y-3">
      {/* Status tabs */}
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

      {/* Category chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted" />
        <m.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all
            ${!activeCategory ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:border-border'}`}
        >
          All
        </m.button>
        {categories.map(cat => {
          const active = activeCategory === cat.id;
          return (
            <m.button
              key={cat.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveCategory(active ? null : cat.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all"
              style={{
                borderColor: active ? cat.color_hex : '#e2e8f0',
                backgroundColor: active ? `${cat.color_hex}15` : 'transparent',
                color: active ? cat.color_hex : '#475569',
              }}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: cat.color_hex }} />
              {cat.name}
            </m.button>
          );
        })}
      </div>
    </div>
  );
}