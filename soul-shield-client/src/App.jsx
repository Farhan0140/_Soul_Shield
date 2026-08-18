import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// Lazy-load pages so the bundle stays light
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Categories from './pages/Categories';
import Profile from './pages/Profile';
import AdminTasks from './pages/AdminTasks';
import TaskTimer from './pages/TaskTimer';
import CategoryDetail from './pages/CategoryDetail';
import AppLayout from './components/AppLayout';
import NotFound from './pages/NotFound';
import OnboardingTooltip from './components/OnboardingTooltip';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return null; // AuthProvider handles its own loader

  return (
    <>
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      
      <OnboardingTooltip />
    </>
  );
}