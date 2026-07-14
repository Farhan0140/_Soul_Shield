import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import AuthLayout from './AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email) e.email = "We need your email to let you in.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "That doesn't look like a valid email.";
    if (!form.password) e.password = "Please enter your password.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back! Great to see you again ✨");
      navigate('/', { replace: true });
    } catch (err) {
      // Humanized errors come from api.js — just surface them on the password field
      setErrors({ password: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue guarding your day">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          icon={Mail}
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          icon={Lock}
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
            <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          <LogIn className="w-4 h-4" />
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        New here?{' '}
        <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}