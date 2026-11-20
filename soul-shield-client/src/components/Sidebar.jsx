import { NavLink, Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { MAIN_LINKS, ADMIN_LINKS } from './navigation';
import Logo from './ui/Logo';
import Avatar from './ui/Avatar';
import Tooltip from './ui/Tooltip';

function NavItem({ link }) {
  const Icon = link.icon;
  return (
    <NavLink
      to={link.to}
      end={link.end}
      className={({ isActive }) =>
        cn(
          'group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors',
          isActive
            ? 'bg-surface font-medium text-fg shadow-[inset_0_0_0_1px_var(--border-c),var(--elev-1)]'
            : 'text-fg-2 hover:bg-sunken hover:text-fg'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary-ink' : 'text-muted group-hover:text-fg-2')}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {link.label}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-sunken/60 lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link to="/" aria-label="SoulShield home" className="rounded-lg">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 pt-4 pb-2 text-xs text-muted">Workspace</p>
        <div className="space-y-0.5">
          {MAIN_LINKS.map((link) => <NavItem key={link.to} link={link} />)}
        </div>

        {isAdmin && (
          <>
            <p className="px-3 pt-6 pb-2 text-xs text-muted">Administration</p>
            <div className="space-y-0.5">
              {ADMIN_LINKS.map((link) => <NavItem key={link.to} link={link} />)}
            </div>
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user?.full_name} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">{user?.full_name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <Tooltip label="Log out" align="end">
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}
