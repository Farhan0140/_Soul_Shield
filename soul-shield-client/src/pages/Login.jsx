import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import AuthLayout from './AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Checkbox from '../components/ui/Checkbox';
import Alert from '../components/ui/Alert';
import TakeTourButton from '../components/TakeTourButton';

export default function Login() {
  const { login, sessionExpired } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email) e.email = "Enter your email";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "That doesn't look like a valid email.";
    if (!form.password) e.password = "Enter your password";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (loading || !validate()) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Signed in");
      navigate('/', { replace: true });
    } catch (err) {
      // Humanized errors come from api.js — shown as a form-level alert.
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Pick up today's deeds where you left off">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {sessionExpired && !errors.form && (
          <Alert tone="warning" title="Your session expired">
            Please sign in again to pick up where you left off.
          </Alert>
        )}
        {errors.form && (
          <Alert tone="danger" title="Couldn't sign you in">
            {errors.form}
          </Alert>
        )}

        <Input
          label="Email address"
          type="email"
          icon={Mail}
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          type="password"
          icon={Lock}
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete="current-password"
          labelAction={
            <Link to="/forgot-password" className="text-[13px] font-medium text-primary-ink hover:underline">
              Forgot password?
            </Link>
          }
        />

        <Checkbox label="Remember me" />

        <Button type="submit" size="lg" loading={loading} fullWidth>
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <TakeTourButton className="mt-6" />

      <p className="mt-8 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-medium text-primary-ink underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
