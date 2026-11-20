import { Calendar, ChevronDown } from 'lucide-react';
import { fmtDate, prettyDate, parseDateKey } from '../hooks/useTasks';
import Popover from './ui/Popover';
import Input from './ui/Input';
import Button from './ui/Button';

const PRESETS = [
  { key: '7d',  label: 'Last 7 days',  days: 6 },
  { key: '30d', label: 'Last 30 days', days: 29 },
  { key: '90d', label: 'Last 90 days', days: 89 },
  { key: 'this_week', label: 'This week', special: 'week' },
  { key: 'this_month', label: 'This month', special: 'month' },
];

export default function DateRangePicker({ range, setRange }) {
  const applyPreset = (preset, close) => {
    const today = new Date();
    let from, to = new Date(today);

    if (preset.special === 'week') {
      from = new Date(today);
      from.setDate(today.getDate() - today.getDay()); // Sunday
    } else if (preset.special === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      from = new Date(today);
      from.setDate(today.getDate() - preset.days);
    }
    setRange({ from, to });
    close();
  };

  // Date inputs give 'YYYY-MM-DD'; read it as a local day (see parseDateKey).
  const handleFromChange = (val) => {
    if (!val) return;
    const d = parseDateKey(val);
    if (!isNaN(d) && d <= range.to) setRange({ ...range, from: d });
  };
  const handleToChange = (val) => {
    if (!val) return;
    const d = parseDateKey(val);
    if (!isNaN(d) && d >= range.from) setRange({ ...range, to: d });
  };

  return (
    <Popover
      label="Choose a date range"
      align="responsive"
      panelClassName="w-80 p-4"
      trigger={(props) => (
        <Button variant="secondary" {...props}>
          <Calendar className="h-4 w-4 text-primary-ink" />
          <span className="tabular-nums">{prettyDate(range.from)} – {prettyDate(range.to)}</span>
          <ChevronDown className="h-4 w-4 text-muted" />
        </Button>
      )}
    >
      {({ close }) => (
        <>
          <p className="mb-3 text-sm font-semibold text-fg">Date range</p>

          {/* Custom inputs */}
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <Input
              label="From"
              type="date"
              size="md"
              value={fmtDate(range.from)}
              onChange={(e) => handleFromChange(e.target.value)}
            />
            <Input
              label="To"
              type="date"
              size="md"
              value={fmtDate(range.to)}
              onChange={(e) => handleToChange(e.target.value)}
            />
          </div>

          {/* Presets */}
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted">Quick select</p>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p, close)}
                  className="h-9 rounded-lg px-3 text-left text-[13px] font-medium text-fg-2 transition-colors hover:bg-sunken hover:text-fg"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Popover>
  );
}
