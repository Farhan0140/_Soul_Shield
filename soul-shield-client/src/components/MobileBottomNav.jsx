import { NavLink, useLocation } from 'react-router-dom';
import { m } from 'framer-motion';
import { Home, Calendar, Tags, User, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  { to: '/',           icon: Home,     label: 'Home' },
  { to: '/history',    icon: Calendar, label: 'History' },
  { to: '/categories', icon: Tags,     label: 'Categories' },
  { to: '/profile',    icon: User,     label: 'Profile' },
];

export default function MobileBottomNav() {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <>
      {/* Spacer so content doesn't get hidden behind the nav */}
      <div className="lg:hidden h-20" />

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border shadow-lg">
        <div className="flex items-center justify-around px-2 py-2">
          {LINKS.map(link => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[60px]
                    ${isActive ? 'text-primary' : 'text-muted'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <m.div
                        layoutId="mobile-nav-pill"
                        className="absolute inset-0 bg-primary/10 rounded-xl -z-0"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className="relative z-10">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="relative z-10 text-[10px] font-semibold">{link.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Admin link — only if admin AND on admin route (to save space) */}
          {isAdmin && isAdminRoute && (
            <NavLink
              to="/admin/tasks"
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-warning min-w-[60px]"
            >
              <Shield className="w-5 h-5" />
              <span className="text-[10px] font-semibold">Admin</span>
            </NavLink>
          )}
        </div>
      </nav>
    </>
  );
}