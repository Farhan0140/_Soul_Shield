import { motion } from 'framer-motion';
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
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {STATUS_TABS.map(tab => (
          <motion.button
            key={tab.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveStatus(tab.key)}
            className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${activeStatus === tab.key ? 'text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {activeStatus === tab.key && (
              <motion.div
                layoutId="status-pill"
                className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all
            ${!activeCategory ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
        >
          All
        </motion.button>
        {categories.map(cat => {
          const active = activeCategory === cat.id;
          return (
            <motion.button
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
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}