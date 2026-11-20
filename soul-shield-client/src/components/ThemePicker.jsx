import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import SegmentedControl from './ui/SegmentedControl';

const OPTIONS = [
  { value: 'lemon-light', label: 'Light', icon: Sun },
  { value: 'lemon-dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / follow-the-OS appearance switch. */
export default function ThemePicker() {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      ariaLabel="Appearance"
      options={OPTIONS}
      value={preference}
      onChange={setPreference}
    />
  );
}
