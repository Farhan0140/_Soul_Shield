import { Outlet } from 'react-router-dom';
import { m } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2 px-4 py-3">
          <m.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white"
          >
            <ShieldCheck className="w-5 h-5" />
          </m.div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            SoulShield
          </h1>
        </div>
      </header>

      <main className="flex-1 lg:ml-64 p-4 md:p-8 pt-20 lg:pt-8 pb-24 lg:pb-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}