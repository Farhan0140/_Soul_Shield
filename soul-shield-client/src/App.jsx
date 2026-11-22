import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

import AppLayout from './components/AppLayout';

// Each page is its own chunk, downloaded the first time it's opened, so the
// initial load only carries the app shell. Pages inside the app show a page
// skeleton meanwhile (Suspense in AppLayout).
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const History = lazy(() => import('./pages/History'));
const Categories = lazy(() => import('./pages/Categories'));
const Profile = lazy(() => import('./pages/Profile'));
const AdminTasks = lazy(() => import('./pages/AdminTasks'));
const AdminFeedback = lazy(() => import('./pages/AdminFeedback'));
const TaskTimer = lazy(() => import('./pages/TaskTimer'));
const CategoryDetail = lazy(() => import('./pages/CategoryDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));
import OnboardingTooltip from './components/OnboardingTooltip';
import ServerWakeBanner from './components/ServerWakeBanner';
import AppBootSkeleton from './components/AppBootSkeleton';

export default function App() {
  const { user, loading } = useAuth();

  // The initial /users/me check can sit through a server cold start: show the
  // app's own frame as a skeleton (plus the wake-up pill if it takes a while)
  // instead of a blank or full-screen loading page.
  if (loading) {
    return (
      <>
        <AppBootSkeleton />
        <ServerWakeBanner />
      </>
    );
  }

  return (
    <>
      {/* Fallback for the full-screen pages (sign-in, sign-up, 404): their
          chunks are small, so a brief blank page on the theme background beats
          a skeleton of a different layout. */}
      <Suspense fallback={null}>
      <Routes>
        {/* Public routes — redirect to home if already logged in */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected routes — wrapped in shared layout */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="history" element={<History />} />
          <Route path="categories" element={<Categories />} />
          <Route path="category/:id" element={<CategoryDetail />} />
          <Route path="tasks/:taskId/timer" element={<TaskTimer />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin/tasks" element={<ProtectedRoute adminOnly><AdminTasks /></ProtectedRoute>} />
          <Route path="admin/feedback" element={<ProtectedRoute adminOnly><AdminFeedback /></ProtectedRoute>} />
        </Route>

        {/* Unknown URLs show the 404 page (it links back home). */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      
      {/* Only inside the app (signed in, or the demo's visitor): never over
          the sign-in or sign-up pages. */}
      {user && <OnboardingTooltip />}
      <ServerWakeBanner />
    </>
  );
}