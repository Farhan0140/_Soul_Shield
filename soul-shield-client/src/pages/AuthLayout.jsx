import { m } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthLayout({ children, title, subtitle }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Animated background blobs */}
      <m.div
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
      />
      <m.div
        animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-20 -right-20 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40"
      />

      <m.div
        key={pathname}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-slate-100 p-8"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-6">
          <m.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white"
          >
            <ShieldCheck className="w-6 h-6" />
          </m.div>
          <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            SoulShield
          </span>
        </Link>

        {title && (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
        )}

        {children}
      </m.div>

      {/* Tiny floating sparkles */}
      <Sparkles className="absolute top-10 right-10 w-4 h-4 text-indigo-300 animate-pulse" />
      <Sparkles className="absolute bottom-20 left-10 w-3 h-3 text-purple-300 animate-pulse" />
    </div>
  );
}