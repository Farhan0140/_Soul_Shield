import { useMemo } from 'react';
import { motion } from 'framer-motion';

// Deterministic gradient from name (so same user always gets same colors)
const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
  'from-lime-500 to-green-600',
  'from-cyan-500 to-indigo-600',
];

function hashName(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function AnimatedAvatar({ name, size = 80, className = '', animate = true }) {
  const initials = useMemo(() => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [name]);

  const gradient = GRADIENTS[hashName(name) % GRADIENTS.length];

  return (
    <motion.div
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={animate ? { scale: 1.05, rotate: 3 } : {}}
      className={`relative inline-flex items-center justify-center rounded-full bg-gradient-to-br ${gradient}
        text-white font-bold shadow-lg select-none overflow-hidden ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-label={`Avatar for ${name || 'user'}`}
    >
      {/* Subtle shine effect */}
      <motion.div
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
      />
      <span className="relative drop-shadow-sm">{initials}</span>
    </motion.div>
  );
}