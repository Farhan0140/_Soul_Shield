import { useState } from 'react';
import { m } from 'framer-motion';
import {
  User, Mail, Shield, LogOut, KeyRound, Target, Flame, Trophy,
  Sparkles, Calendar, AlertTriangle, Settings, Trash2, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { usePersonalStats } from '../hooks/usePersonalStats';
import AnimatedAvatar from '../components/AnimatedAvatar';
import StatCard from '../components/StatCard';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ConfirmModal from '../components/ConfirmModal';
import Button from '../components/ui/Button';

export default function Profile() {
  const { user, logout, isAdmin } = useAuth();
  const toast = useToast();
  const { stats, loading: statsLoading } = usePersonalStats();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out. See you soon 👋");
  };

  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { staggerChildren: 0.08 } },
  };
  const child = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

  return (
    <m.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="space-y-6 max-w-5xl"
    >
      {/* Header */}
      <m.div variants={child}>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
          <User className="w-7 h-7 text-indigo-500" />
          Profile
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          This is you — take a look at your journey so far ✨
        </p>
      </m.div>

      {/* User info card */}
      <m.div
        variants={child}
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
      >
        {/* Gradient banner */}
        <div className="h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
        </div>

        <div className="px-6 pb-6 -mt-12 relative">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="ring-4 ring-white rounded-full">
              <AnimatedAvatar name={user?.full_name} size={96} />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800 truncate">{user?.full_name}</h2>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wide">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-600 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </m.div>

      {/* Personal stats */}
      <m.div variants={child}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <span className="w-6 h-0.5 bg-slate-300" />
          Your journey
        </h3>

        {statsLoading || !stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-slate-200 mb-3" />
                <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-7 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={Trophy}
              label="Completed"
              value={stats.totalCompleted}
              sub={`of ${stats.totalTasks} total tasks`}
              gradient="from-emerald-500 to-teal-500"
              delay={0}
            />
            <StatCard
              icon={Target}
              label="Completion rate"
              value={stats.completionRate}
              suffix="%"
              sub="over the last year"
              gradient="from-indigo-500 to-purple-600"
              delay={0.05}
            />
            <StatCard
              icon={Flame}
              label="Current streak"
              value={stats.streak}
              sub={stats.streak > 0 ? "Keep it going 🔥" : "Start one today!"}
              gradient="from-orange-500 to-rose-500"
              delay={0.1}
            />
            <StatCard
              icon={stats.favoriteCategory ? Sparkles : Calendar}
              label="Favorite category"
              value={stats.favoriteCategory || '—'}
              sub={stats.favoriteCategory ? `${stats.favoriteCategoryCount} completions` : 'No completions yet'}
              gradient="from-sky-500 to-indigo-500"
              delay={0.15}
            />
          </div>
        )}

        {stats?.bestDay && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 flex items-center gap-3"
          >
            <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <p className="text-sm text-indigo-900">
              Your most productive day is <strong>{stats.bestDay}</strong> — maybe schedule important tasks then?
            </p>
          </m.div>
        )}
      </m.div>

      {/* Account settings */}
      <m.div variants={child}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <span className="w-6 h-0.5 bg-slate-300" />
          Account settings
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {/* Change password */}
          <button
            onClick={() => setPasswordModalOpen(true)}
            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform">
              <KeyRound className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Change password</p>
              <p className="text-xs text-slate-500">We'll send a verification code to your email</p>
            </div>
            <span className="text-xs font-medium text-indigo-600 group-hover:translate-x-1 transition-transform">
              Update →
            </span>
          </button>

          {/* Email (read-only with info) */}
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Email address</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
              Verified
            </span>
          </div>

          {/* Role (read-only) */}
          <div className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Role</p>
              <p className="text-xs text-slate-500">
                {isAdmin ? 'Administrator — you can manage fixed tasks for all users' : 'Standard user'}
              </p>
            </div>
          </div>
        </div>
      </m.div>

      {/* Danger zone */}
      <m.div variants={child}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-3 flex items-center gap-2">
          <span className="w-6 h-0.5 bg-rose-300" />
          Danger zone
        </h3>

        <div className="bg-white rounded-2xl border-2 border-rose-200 overflow-hidden">
          {/* Logout */}
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full flex items-center gap-4 p-4 hover:bg-rose-50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center group-hover:scale-105 transition-transform">
              <LogOut className="w-5 h-5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Log out</p>
              <p className="text-xs text-slate-500">You'll need to sign in again to access your tasks</p>
            </div>
          </button>

          {/* Delete account (placeholder) */}
          <div className="border-t-2 border-rose-100 flex items-center gap-4 p-4 bg-rose-50/30">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">Delete account</p>
              <p className="text-xs text-slate-500">Permanently remove your account and all data</p>
            </div>
            <button
              disabled
              className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-400 text-xs font-semibold cursor-not-allowed"
              title="Coming soon"
            >
              Coming soon
            </button>
          </div>
        </div>
      </m.div>

      {/* Footer note */}
      <m.p
        variants={child}
        className="text-center text-xs text-slate-400 pt-4"
      >
        SoulShield · Guarding your daily deeds ✨
      </m.p>

      {/* Modals */}
      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />

      <ConfirmModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Log out?"
        message="You'll need to sign in again to see your tasks. Don't worry — nothing will be lost."
        confirmLabel="Yes, log me out"
        variant="primary"
        icon={LogOut}
      >
        <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 mt-1">
          <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-800">
            Your tasks, categories, and history will all be here when you come back.
          </p>
        </div>
      </ConfirmModal>
    </m.div>
  );
}