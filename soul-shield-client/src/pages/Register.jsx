import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, ArrowLeft, KeyRound } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import AuthLayout, { StepIndicator } from './AuthLayout';
import TakeTourButton from '../components/TakeTourButton';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { validateEmail, validateFullName, validateNewPassword, PASSWORD_MIN } from '../utils/validation';

const STEPS = [
  { key: 'email',    title: "Create an account",  subtitle: "Start with your email" },
  // { key: 'otp',      title: 'Check your inbox',              subtitle: "We sent a 6-digit code. It expires in 5 minutes." },
  { key: 'account',  title: 'Create your account',           subtitle: "Your name, a password and a security question for recovery" },
];

export default function Register() {
  const navigate = useNavigate();
  const toast = useToast();
  const { login } = useAuth();
  const { /* sendOtp, verifyOtp, */ registerUser } = useApi();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [full_name, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [security_answer, setSecurityAnswer] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // resend timer

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ---------- STEP 1: Continue with email (OTP send removed) ----------
  const handleSendOtp = async (e) => {
    e?.preventDefault?.();
    const emailError = validateEmail(email);
    if (emailError) return setErrors({ email: emailError });
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
    const nameError = validateFullName(full_name);
    if (nameError) errs.name = nameError;
    const passwordError = validateNewPassword(password);
    if (passwordError) errs.password = passwordError;
    if (!trimmedAnswer) errs.security_answer = "Please set a security answer — you'll need it to reset your password.";
    else if (trimmedAnswer.length < 3) errs.security_answer = "At least 3 characters, please.";
    else if (trimmedAnswer.length > 100) errs.security_answer = "Keep it under 100 characters.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await registerUser(full_name.trim(), email.trim(), password, trimmedAnswer);
      await login(email.trim(), password);
      toast.success("Account created");
      navigate('/', { replace: true });
    } catch (err) {
      // Most likely "email already exists" — show on password field as a generic form error
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  const stepMotion = {
    initial: { opacity: 0, x: 12 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -12 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
  };

  return (
    <AuthLayout title={STEPS[step].title} subtitle={STEPS[step].subtitle}>
      <StepIndicator steps={STEPS} step={step} />

      <AnimatePresence mode="wait" initial={false}>
        {/* ===== STEP 1: Email ===== */}
        {step === 0 && (
          <m.form key="email" {...stepMotion} onSubmit={handleSendOtp} noValidate className="space-y-5">
            <Input
              label="Email address" type="email" icon={Mail}
              value={email} error={errors.email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
            <Button type="submit" size="lg" loading={loading} fullWidth>
              Continue <ArrowRight className="h-4 w-4" />
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
                  className={`w-12 h-14 text-center text-xl font-medium rounded-xl border-2 outline-none transition-[border-color,box-shadow]
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
                <button type="button" onClick={handleResend} className="text-indigo-600 font-medium hover:text-indigo-700">
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
          <m.form key="account" {...stepMotion} onSubmit={handleCreate} noValidate className="space-y-5">
            {errors.form && (
              <Alert tone="danger" title="Couldn't create your account">
                {errors.form}
              </Alert>
            )}
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
              <Mail className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 truncate text-sm text-fg-2">{email}</span>
            </div>
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
              hint={`At least ${PASSWORD_MIN} characters.`}
            />
            <Input
              label="Security verification answer" icon={KeyRound}
              value={security_answer} error={errors.security_answer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="A personal answer you'll always remember"
              autoComplete="off"
              hint="This can be your nickname, your favorite thing, your pet's name, your father's or mother's name, your favorite place, or any personal word or phrase that only you know. You'll be asked for it if you ever need to reset your password, so choose something memorable but hard for others to guess."
            />
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep(0)} disabled={loading}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" size="lg" loading={loading} className="flex-1">
                Create account <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </m.form>
        )}
      </AnimatePresence>

      {step === 0 && <TakeTourButton className="mt-6" />}

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-fg underline decoration-primary decoration-2 underline-offset-4 hover:decoration-primary-ink">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
