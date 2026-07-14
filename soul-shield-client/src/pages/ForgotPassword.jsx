import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import AuthLayout from './AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const STEPS = [
  { key: 'email', title: 'Reset your password', subtitle: "Enter your email and we'll send you a code." },
  { key: 'otp',   title: 'Verify it\'s you',    subtitle: "Enter the 6-digit code we just emailed you." },
  { key: 'new',   title: 'Pick a new password', subtitle: "Choose something strong — and different from the last one." },
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    if (!email) return setErrors({ email: "We need your email to continue." });
    if (!/\S+@\S+\.\S+/.test(email)) return setErrors({ email: "That doesn't look like a valid email." });
    setErrors({});
    setLoading(true);
    try {
      await api.post('/send-otp', { email }, { auth: false });
      toast.success("Code sent! Check your inbox 📬");
      setStep(1);
      setCooldown(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setErrors({ email: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...otp];
    pasted.split('').forEach((ch, i) => (next[i] = ch));
    setOtp(next);
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e?.preventDefault?.();
    const code = otp.join('');
    if (code.length !== 6) return setErrors({ otp: "Please enter all 6 digits." });
    setErrors({});
    setLoading(true);
    try {
      await api.post('/verify-otp', { email, otp: code }, { auth: false });
      toast.success("Verified! Now set a new password 🔐");
      setStep(2);
    } catch (err) {
      setErrors({ otp: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!password) return setErrors({ password: "Please enter a new password." });
    if (password.length < 6) return setErrors({ password: "At least 6 characters — keep it safe." });
    setErrors({});
    setLoading(true);
    try {
      await api.post('/users/reset-password', { email, new_password: password }, { auth: false });
      toast.success("Password updated! You can now sign in 🎉");
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors({ password: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await api.post('/send-otp', { email }, { auth: false });
      toast.success("New code sent!");
      setCooldown(60);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <motion.div
            animate={{ scale: i === step ? 1.1 : 1 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
              ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
          >
            {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </motion.div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <AuthLayout title={STEPS[step].title} subtitle={STEPS[step].subtitle}>
      <StepIndicator />

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.form
            key="email"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSendOtp} className="space-y-4"
          >
            <Input
              label="Email address" type="email" icon={Mail}
              value={email} error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full">
              Send reset code <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.form>
        )}

        {step === 1 && (
          <motion.form
            key="otp"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onSubmit={handleVerifyOtp} className="space-y-5"
          >
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
                    ${errors.otp ? 'border-rose-400' : 'border-slate-200 focus:border-indigo-500'}
                    focus:shadow-sm focus:shadow-indigo-100`}
                />
              ))}
            </div>
            {errors.otp && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-rose-500">
                {errors.otp}
              </motion.p>
            )}
            <div className="text-center text-sm text-slate-500">
              Didn't get it?{' '}
              {cooldown > 0 ? (
                <span className="text-slate-400">Resend in {cooldown}s</span>
              ) : (
                <button type="button" onClick={handleResend} className="text-indigo-600 font-semibold hover:text-indigo-700">
                  Resend code
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(0)} className="flex-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                Verify <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.form>
        )}

        {step === 2 && (
          <motion.form
            key="new"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onSubmit={handleReset} className="space-y-4"
          >
            <Input
              label="New password" type="password" icon={KeyRound}
              value={password} error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                Reset password <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="text-center text-sm text-slate-500 mt-6">
        Remembered it?{' '}
        <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}