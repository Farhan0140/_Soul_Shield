import { useState } from 'react';
import {
  Mail, Shield, LogOut, KeyRound, Target, Flame, Trophy,
  Sparkles, Calendar, Trash2, ChevronRight, Palette, BadgeCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { usePersonalStats } from '../hooks/usePersonalStats';
import Avatar from '../components/ui/Avatar';
import StatCard from '../components/StatCard';
import ChangePasswordModal from '../components/ChangePasswordModal';
import DeleteAccountModal from '../components/DeleteAccountModal';
import ConfirmModal from '../components/ConfirmModal';
import ThemePicker from '../components/ThemePicker';
import PageHeader, { SectionHeader } from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { SkeletonGroup, StatGridSkeleton } from '../components/ui/Skeleton';

/** One row of a settings list: icon tile, title + description, trailing slot. */
function SettingRow({ icon: Icon, title, description, trailing, danger = false }) {
  return (
    <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
      <span className={`icon-tile h-9 w-9 ${danger ? 'text-danger' : ''}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {description && <p className="mt-0.5 break-words text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

export default function Profile() {
  const { user, logout, isAdmin } = useAuth();
  const toast = useToast();
  const { stats, loading: statsLoading } = usePersonalStats();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out. See you soon 👋");
  };

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Profile" description="Your account, appearance and progress at a glance." />

      {/* Identity */}
      <section aria-label="Account" className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <Avatar name={user?.full_name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{user?.full_name}</h2>
            {isAdmin && <Badge tone="warning" icon={Shield}>Admin</Badge>}
          </div>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {user?.email}
          </p>
        </div>
      </section>

      {/* Personal stats */}
      <section aria-label="Your journey">
        <SectionHeader title="Your journey" meta="Last 12 months" />

        {statsLoading || !stats ? (
          <SkeletonGroup label="Loading your stats…">
            <StatGridSkeleton />
          </SkeletonGroup>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={Trophy}
              label="Completed"
              value={stats.totalCompleted}
              sub={`of ${stats.totalTasks} total tasks`}
            />
            <StatCard
              icon={Target}
              accent
              label="Completion rate"
              value={stats.completionRate}
              suffix="%"
              sub="over the last year"
              delay={0.04}
            />
            <StatCard
              icon={Flame}
              label="Current streak"
              value={stats.streak}
              sub={stats.streak > 0 ? "Keep it going 🔥" : "Start one today!"}
              delay={0.08}
            />
            <StatCard
              icon={stats.favoriteCategory ? Sparkles : Calendar}
              label="Favorite category"
              value={stats.favoriteCategory || '—'}
              sub={stats.favoriteCategory ? `${stats.favoriteCategoryCount} completions` : 'No completions yet'}
              delay={0.12}
            />
          </div>
        )}

        {stats?.bestDay && (
          <Alert tone="neutral" icon={Calendar} className="mt-3">
            Your most productive day is <strong className="font-semibold text-fg">{stats.bestDay}</strong> — maybe schedule important tasks then?
          </Alert>
        )}
      </section>

      {/* Appearance + account */}
      <section aria-label="Settings">
        <SectionHeader title="Settings" />
        <div className="card divide-y divide-border">
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="icon-tile h-9 w-9">
                <Palette className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">Appearance</p>
                <p className="mt-0.5 text-[13px] text-muted">Light, dark, or match your device.</p>
              </div>
            </div>
            <ThemePicker />
          </div>

          <SettingRow
            icon={KeyRound}
            title="Password"
            description="Confirm your current password, then pick a new one."
            trailing={
              <Button variant="secondary" size="sm" onClick={() => setPasswordModalOpen(true)}>
                Change <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            }
          />

          <SettingRow
            icon={Mail}
            title="Email address"
            description={user?.email}
            trailing={<Badge tone="success" icon={BadgeCheck}>Verified</Badge>}
          />

          <SettingRow
            icon={Shield}
            title="Role"
            description={isAdmin ? 'Administrator — you can manage fixed tasks for all users' : 'Standard user'}
          />
        </div>
      </section>

      {/* Danger zone */}
      <section aria-label="Danger zone">
        <SectionHeader title="Danger zone" tone="danger" />
        <div className="card divide-y divide-border !border-danger/25">
          <SettingRow
            icon={LogOut}
            title="Log out"
            description="You'll need to sign in again to access your tasks."
            trailing={
              <Button variant="secondary" size="sm" onClick={() => setLogoutConfirmOpen(true)}>
                Log out
              </Button>
            }
          />
          {/* Delete account (admins manage everyone's fixed tasks, so the API refuses self-deletion for them) */}
          <SettingRow
            icon={Trash2}
            danger
            title="Delete account"
            description={
              isAdmin
                ? "Admin accounts can't be deleted from the app."
                : 'Permanently remove your account and all data.'
            }
            trailing={
              <Button variant="danger-soft" size="sm" disabled={isAdmin} onClick={() => setDeleteModalOpen(true)}>
                Delete…
              </Button>
            }
          />
        </div>
      </section>

      <p className="pt-2 text-center text-xs text-subtle">SoulShield · Guarding your daily deeds</p>

      {/* Modals */}
      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />

      <DeleteAccountModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      />

      <ConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Log out?"
        message="You'll need to sign in again to see your tasks. Don't worry — nothing will be lost."
        confirmLabel="Log out"
        variant="primary"
        icon={LogOut}
      >
        <Alert tone="neutral">
          Your tasks, categories, and history will all be here when you come back.
        </Alert>
      </ConfirmModal>
    </div>
  );
}
