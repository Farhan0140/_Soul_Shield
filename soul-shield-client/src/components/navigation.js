import { Home, CalendarDays, Tags, User, Shield, MessageSquare } from 'lucide-react';

// Single source for the app's navigation, shared by the desktop sidebar and
// the mobile bottom bar so the two can't drift apart.
export const MAIN_LINKS = [
  { to: '/', icon: Home, label: 'Today', end: true },
  { to: '/history', icon: CalendarDays, label: 'History' },
  { to: '/categories', icon: Tags, label: 'Categories' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const ADMIN_LINKS = [
  { to: '/admin/tasks', icon: Shield, label: 'Admin Panel', shortLabel: 'Admin' },
  // badge: shows the unread count from FeedbackNotificationsContext.
  { to: '/admin/feedback', icon: MessageSquare, label: 'Feedback', badge: 'feedback' },
];
