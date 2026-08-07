import { useState, useRef, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Lock, KeyRound, Mail, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Input from './ui/Input';
import Button from './ui/Button';

const STEPS = [
  { key: 'send',  title: 'Change your password',     subtitle: "Set a new password for your account." },
  // { key: 'otp',   title: 'Enter the code',           subtitle: "A 6-digit code just landed in your inbox." },
  { key: 'new',   title: 'Pick a new password',      subtitle: "Choose something strong — and different from the last one." },
];

export default function ChangePasswordModal({ open, onClose }) {
  const { user } = useAuth();
  const { /* sendOtp, verifyOtp, */ resetPassword } = useApi();
  const toast = useToast();

  const [step, setStep] = useState(0);
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

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setOtp(['', '', '', '', '', '']);
      setPassword('');
      setErrors({});
      setCooldown(0);
    }
  }, [open]);

  // Step 1: Send OTP (removed)
  const handleSendOtp = async () => {
    setErrors({});
    setLoading(true);
    try {
      // await sendOtp(user.email);
      // toast.success("Code sent! Check your inbox 📬");
      setStep(1);
      // setCooldown(60);
      // setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: OTP handlers (removed)
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

  // const handleVerifyOtp = async () => {
  //   const code = otp.join('');
  //   if (code.length !== 6) return setErrors({ otp: "Please enter all 6 digits." });
  //   setErrors({});
  //   setLoading(true);
  //   try {
  //     await verifyOtp(user.email, code);
  //     toast.success("Verified! Now set your new password 🔐");
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
  //     await sendOtp(user.email);
  //     toast.success("New code sent!");
  //     setCooldown(60);
  //   } catch (err) {
  //     toast.error(err.message);
  //   }
  // };

  // Step 3: Set new password
  const handleReset = async () => {
    if (!password) return setErrors({ password: "Please enter a new password." });
    if (password.length < 6) return setErrors({ password: "At least 6 characters — keep it safe." });
    setErrors({});
    setLoading(true);
    try {
      await resetPassword(user.email, password);
      toast.success("Password updated! You're all set 🎉");
      onClose();
    } catch (err) {
      setErrors({ password: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-fg">{STEPS[step].title}</h2>
                <p className="text-xs text-muted mt-0.5">{STEPS[step].subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-bg transition-colors"
              >
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 px-6 pb-4">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  <m.div
                    animate={{ scale: i === step ? 1.1 : 1 }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                      ${i < step ? 'bg-success text-white' : i === step ? 'bg-primary text-white' : 'bg-bg text-muted'}`}
                  >
                    {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </m.div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-6 h-0.5 ${i < step ? 'bg-success' : 'bg-border'}`} />
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              <AnimatePresence mode="wait">
                {/* Step 1: Confirm (OTP send removed) */}
                {step === 0 && (
                  <m.div
                    key="send"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-3">
                      <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                      <p className="text-sm text-primary">
                        Changing password for <strong>{user?.email}</strong>
                      </p>
                    </div>
                    {errors.form && (
                      <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-danger">
                        {errors.form}
                      </m.p>
                    )}
                    <Button onClick={handleSendOtp} loading={loading} className="w-full">
                      Continue <ArrowRight className="w-4 h-4" />
                    </Button>
                  </m.div>
                )}

                {/* Step 2: OTP (removed)
                {step === 1 && (
                  <m.div
                    key="otp"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
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
                          className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
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
                      <Button variant="secondary" onClick={() => setStep(0)} className="flex-1">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button onClick={handleVerifyOtp} loading={loading} className="flex-1">
                        Verify <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </m.div>
                )}
                */}

                {/* Step 2: New password */}
                {step === 1 && (
                  <m.div
                    key="new"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <Input
                      label="New password" type="password" icon={KeyRound}
                      value={password} error={errors.password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setStep(0)} className="flex-1">
                        <ArrowLeft className="w-4 h-4" /> Back
                      </Button>
                      <Button onClick={handleReset} loading={loading} className="flex-1">
                        Update password <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}