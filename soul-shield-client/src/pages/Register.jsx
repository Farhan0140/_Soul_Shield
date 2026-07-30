import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, ArrowLeft, ShieldCheck, CheckCircle2, KeyRound } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import AuthLayout from './AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const STEPS = [
  { key: 'email',    title: "Let's start with your email",  subtitle: "Enter your email to get started." },
  // { key: 'otp',      title: 'Check your inbox',              subtitle: "We sent a 6-digit code. It expires in 5 minutes." },
  { key: 'account',  title: 'Create your account',           subtitle: "Pick a name and a strong password — you're almost there!" },
];

function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <m.div
            animate={{ scale: i === step ? 1.1 : 1 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
              ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
          >
            {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </m.div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const { login } = useAuth();
  const { /* sendOtp, verifyOtp, */ registerUser } = useApi();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [full_name, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [security_answer, setSecurityAnswer] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // resend timer
  const otpRefs = useRef([]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ---------- STEP 1: Continue with email (OTP send removed) ----------
  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    if (!email) return setErrors({ email: "We need your email to continue." });
    if (!/\S+@\S+\.\S+/.test(email)) return setErrors({ email: "That doesn't look like a valid email." });
    setErrors({});
    setLoading(true);
    try {
      // await sendOtp(email);
      // toast.success("Code sent! Check your inbox 📬");
      setStep(1);
      // setCooldown(60);
      // setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setErrors({ email: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ---------- STEP 2: Verify OTP (removed) ----------
  // const handleOtpChange = (i, val) => {
  //   if (!/^\d?$/.test(val)) return;
  //   const next = [...otp];
  //   next[i] = val;
  //   setOtp(next);
  //   if (val && i < 5) otpRefs.current[i + 1]?.focus();
  // };
  // const handleOtpKeyDown = (i, e) => {
  //   if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  // };
  // const handlePaste = (e) => {
  //   e.preventDefault();
  //   const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
  //   const next = [...otp];
  //   pasted.split('').forEach((ch, i) => (next[i] = ch));
  //   setOtp(next);
  //   otpRefs.current[Math.min(pasted.length, 5)]?.focus();
  // };

  // const handleVerifyOtp = async (e) => {
  //   e?.preventDefault?.();
  //   const code = otp.join('');
  //   if (code.length !== 6) return setErrors({ otp: "Please enter all 6 digits." });
  //   setErrors({});
  //   setLoading(true);
  //   try {
  //     await verifyOtp(email, code);
  //     toast.success("Email verified! 🎉");
  //     setStep(2);
  //   } catch (err) {
  //     setErrors({ otp: err.message });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleResend = async () => {
  //   if (cooldown > 0) return;
  //   try {
  //     await sendOtp(email);
  //     toast.success("New code sent!");
  //     setCooldown(60);
  //   } catch (err) {
  //     toast.error(err.message);
  //   }
  // };

  // ---------- STEP 3: Create Account ----------
  const handleCreate = async (e) => {
    e.preventDefault();
    const errs = {};
    const trimmedAnswer = security_answer.trim();
    if (!full_name.trim()) errs.name = "What should we call you?";
    if (!password) errs.password = "Please choose a password.";
    else if (password.length < 6) errs.password = "At least 6 characters — keep it safe.";
    if (!trimmedAnswer) errs.security_answer = "Please set a security answer — you'll need it to reset your password.";
    else if (trimmedAnswer.length < 3) errs.security_answer = "At least 3 characters, please.";
    else if (trimmedAnswer.length > 100) errs.security_answer = "Keep it under 100 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await registerUser(full_name, email, password, trimmedAnswer);
      await login(email, password);
      toast.success("Account created! Welcome to SoulShield 🌟");
      navigate('/', { replace: true });
    } catch (err) {
      // Most likely "email already exists" — show on password field as a generic form error
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={STEPS[step].title} subtitle={STEPS[step].subtitle}>
      <StepIndicator step={step} />

      <AnimatePresence mode="wait">
        {/* ===== STEP 1: Email ===== */}
        {step === 0 && (
          <m.form
            key="email"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onSubmit={handleSendOtp} className="space-y-4"
          >
            <Input
              label="Email address" type="email" icon={Mail}
              value={email} error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" loading={loading} className="w-full">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </m.form>
        )}

        {/* ===== STEP 2: OTP (removed) =====
        {step === 1 && (
          <m.form
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
              <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-sm text-rose-500">
                {errors.otp}
              </m.p>
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
          </m.form>
        )}
        ===== */}

        {/* ===== STEP 2: Account ===== */}
        {step === 1 && (
          <m.form
            key="account"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            onSubmit={handleCreate} className="space-y-4"
          >
            {errors.form && (
              <m.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-600 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 flex-shrink-0" /> {errors.form}
              </m.div>
            )}
            <Input
              label="Full name" icon={User}
              value={full_name} error={errors.name}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            <Input
              label="Password" type="password" icon={Lock}
              value={password} error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <div>
              <Input
                label="Security Verification Answer" icon={KeyRound}
                value={security_answer} error={errors.security_answer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Please enter a personal answer that you will always remember."
                autoComplete="off"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                This can be your nickname, your favorite thing, your pet's name, your father's name, your mother's
                name, your favorite place, or any personal word or phrase that only you know. You'll be asked for
                this answer if you ever need to reset your password. Choose something memorable but difficult for
                others to guess.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(0)} className="flex-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button type="submit" loading={loading} className="flex-1">
                Create account <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </m.form>
        )}
      </AnimatePresence>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}