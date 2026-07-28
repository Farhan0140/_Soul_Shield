import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { Home, Search, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 via-white to-purple-50 relative overflow-hidden">
      {/* Animated blobs */}
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative text-center max-w-md"
      >
        {/* Big animated 404 */}
        <m.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="relative inline-block mb-6"
        >
          <h1 className="text-[140px] md:text-[180px] font-black bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent leading-none">
            404
          </h1>
          {/* Floating sparkles around the number */}
          <m.div
            animate={{ y: [0, -10, 0], rotate: [0, 15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-4 -right-4"
          >
            <Sparkles className="w-6 h-6 text-amber-400" fill="currentColor" />
          </m.div>
          <m.div
            animate={{ y: [0, 10, 0], rotate: [0, -15, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
            className="absolute bottom-8 -left-4"
          >
            <Sparkles className="w-5 h-5 text-indigo-400" fill="currentColor" />
          </m.div>
        </m.div>

        {/* Lost compass icon */}
        <m.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 mb-6"
        >
          <Search className="w-10 h-10 text-indigo-600" />
        </m.div>

        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          Oops — you've wandered off the path
        </h2>
        <p className="text-slate-500 mb-6">
          The page you're looking for doesn't exist, or maybe it moved. Let's get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/">
            <Button className="w-full sm:w-auto">
              <Home className="w-4 h-4" /> Back to home
            </Button>
          </Link>
          <Link to="/history">
            <Button variant="secondary" className="w-full sm:w-auto">
              View history
            </Button>
          </Link>
        </div>
      </m.div>
    </div>
  );
}