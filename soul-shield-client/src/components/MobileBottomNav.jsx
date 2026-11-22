import { NavLink } from 'react-router-dom';
import { m } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { MAIN_LINKS, ADMIN_LINKS } from './navigation';
import { useFeedbackNotifications } from '../context/FeedbackNotificationsContext';

/** Bottom tab bar for phones and tablets (hidden from `lg`, where the
 * sidebar takes over). Admins get the Admin Panel as a fifth tab. */
export default function MobileBottomNav() {
  const { isAdmin } = useAuth();
  const { unread } = useFeedbackNotifications();
  const links = isAdmin ? [...MAIN_LINKS, ...ADMIN_LINKS] : MAIN_LINKS;

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden"
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-fg' : 'text-muted hover:text-fg'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative flex h-7 w-12 items-center justify-center">
                    {isActive && (
                      <m.span
                        layoutId="mobile-nav-pill"
                        className="absolute inset-0 rounded-full bg-primary-soft"
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    <Icon className={cn('relative h-5 w-5', isActive && 'text-primary-ink')} aria-hidden="true" />
                    {link.badge === 'feedback' && unread > 0 && (
                      <span
                        className="absolute -top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold tabular-nums text-white"
                        aria-label={`${unread} new`}
                      >
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate px-1">{link.shortLabel || link.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
