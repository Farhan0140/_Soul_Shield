import { useState } from 'react';
import { Compass } from 'lucide-react';
import { startDemo } from '../demo/demoMode';
import { useToast } from './Toast';
import Button from './ui/Button';

/** "Take a tour" entry on the auth screens: opens the app with sample data,
 * no account needed (see demo/demoMode.js). */
export default function TakeTourButton({ className }) {
  const toast = useToast();
  const [starting, setStarting] = useState(false);

  const handleClick = () => {
    setStarting(true);
    if (!startDemo()) {
      setStarting(false);
      toast.error('Your browser is blocking site storage, so the demo can’t start. Allow it for this site and try again.');
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3 text-xs font-medium text-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="secondary" size="lg" fullWidth loading={starting} onClick={handleClick} className="mt-5">
        <Compass className="h-4 w-4 text-primary-ink" /> Take a tour
      </Button>
      <p className="mt-2 text-center text-xs text-muted">
        Explore with sample tasks — no account needed.
      </p>
    </div>
  );
}
