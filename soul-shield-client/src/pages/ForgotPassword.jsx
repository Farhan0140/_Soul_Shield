import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useToast } from '../components/Toast';
import AuthLayout, { StepIndicator } from './AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { validateNewPassword, PASSWORD_MIN } from '../utils/validation';

const STEPS = [
  { key: 'email',  title: 'Reset your password',  subtitle: "Enter the email you signed up with" },
  { key: 'verify', title: 'Verify your identity',  subtitle: "Enter the security answer you set when you created your account" },
  { key: 'new',    title: 'Pick a new password',   subtitle: "Choose something strong and different from the last one" },
];

export default function ForgotPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const { /* sendOtp, verifyOtp, */ verifySecurityAnswer, resetPassword } = useApi();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [security_answer, setSecurityAnswer] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
    setStep(1);
    // await sendOtp(email);
    // setCooldown(60);
    // setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  // ---------- STEP 2: Verify security answer ----------
  const handleVerifyAnswer = async (e) => {
    e?.preventDefault?.();
    const answer = security_answer.trim();
    if (!answer) return setErrors({ security_answer: "Please enter your security answer." });
    setErrors({});
    setLoading(true);
    try {
      const res = await verifySecurityAnswer(email, answer);
      setResetToken(res?.reset_token || '');
      toast.success("Identity verified, choose a new password");
      setStep(2);
    } catch (err) {
      setErrors({ security_answer: err.message });
    } finally {
      setLoading(false);
    }
  };

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
  //     toast.success("Verified! Now set a new password 🔐");
  //     setStep(2);
  //   } catch (err) {
  //     setErrors({ otp: err.message });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!password) return setErrors({ password: "Please enter a new password." });
    const passwordError = validateNewPassword(password);
    if (passwordError) return setErrors({ password: passwordError });
    setErrors({});
    setLoading(true);
    try {
      await resetPassword(resetToken, password);
      toast.success("Password updated, you can sign in now");
      navigate('/login', { replace: true });
    } catch (err) {
      setErrors({ password: err.message });
    } finally {
      setLoading(false);
    }
  };

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

        {/* ===== STEP 2: Verify security answer ===== */}
        {step === 1 && (
          <m.form key="verify" {...stepMotion} onSubmit={handleVerifyAnswer} noValidate className="space-y-5">
            <Alert tone="neutral" icon={ShieldCheck}>
              For security purposes, please enter the personal security answer you created when you registered
              your account.
            </Alert>
            <Input
              label="Security verification answer" icon={KeyRound}
              value={security_answer} error={errors.security_answer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              placeholder="Enter your security answer"
              autoComplete="off"
              autoFocus
            />
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep(0)} disabled={loading}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" size="lg" loading={loading} className="flex-1">
                Verify <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </m.form>
        )}

        {/* ===== STEP 3: New password ===== */}
        {step === 2 && (
          <m.form key="new" {...stepMotion} onSubmit={handleReset} noValidate className="space-y-5">
            <Input
              label="New password" type="password" icon={KeyRound}
              value={password} error={errors.password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              hint={`At least ${PASSWORD_MIN} characters.`}
              autoFocus
            />
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)} disabled={loading}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button type="submit" size="lg" loading={loading} className="flex-1">
                Reset password <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </m.form>
        )}
      </AnimatePresence>

      <p className="mt-8 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link to="/login" className="font-medium text-fg underline decoration-primary decoration-2 underline-offset-4 hover:decoration-primary-ink">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
