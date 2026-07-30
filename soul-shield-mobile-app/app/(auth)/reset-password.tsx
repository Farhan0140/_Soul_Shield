import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { resetPassword, verifySecurityAnswer } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { getErrorMessage } from '@/lib/errors';

type Step = 'email' | 'verify' | 'new';

/**
 * Three-step flow: email -> verify security answer (identity check) -> new password.
 * verifySecurityAnswer returns a short-lived reset_token that resetPassword redeems —
 * there's no way to reach the "new password" step without passing verification first.
 */
export default function ResetPasswordScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    setError(null);
    setStep('verify');
  };

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await verifySecurityAnswer(email.trim(), securityAnswer.trim());
      setResetToken(res.reset_token);
      setStep('new');
    } catch (err) {
      setError(getErrorMessage(err, 'verify-security-answer'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setLoading(true);
    try {
      await resetPassword(resetToken, password);
      router.replace('/(auth)/login');
    } catch (err) {
      setError(getErrorMessage(err, 'reset-password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      {step === 'email' && (
        <>
          <View style={styles.header}>
            <ThemedText type="title">Reset Password</ThemedText>
            <ThemedText type="default">Enter your email to continue.</ThemedText>
          </View>

          <View style={styles.form}>
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />
            {error ? (
              <ThemedText selectable style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
            <PrimaryButton label="Continue" onPress={handleContinue} disabled={!email.trim()} />
          </View>
        </>
      )}

      {step === 'verify' && (
        <>
          <View style={styles.header}>
            <ThemedText type="title">Verify Your Identity</ThemedText>
            <ThemedText type="default">
              For security purposes, please enter the personal security answer you created when you registered your
              account.
            </ThemedText>
          </View>

          <View style={styles.form}>
            <TextField
              label="Security Verification Answer"
              value={securityAnswer}
              onChangeText={setSecurityAnswer}
              placeholder="Enter your security answer"
              autoCapitalize="none"
            />
            {error ? (
              <ThemedText selectable style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <PrimaryButton label="Back" variant="secondary" onPress={() => setStep('email')} />
              </View>
              <View style={styles.rowItem}>
                <PrimaryButton
                  label="Verify"
                  onPress={handleVerify}
                  loading={loading}
                  disabled={!securityAnswer.trim()}
                />
              </View>
            </View>
          </View>
        </>
      )}

      {step === 'new' && (
        <>
          <View style={styles.header}>
            <ThemedText type="title">Pick a New Password</ThemedText>
            <ThemedText type="default">Identity verified successfully. You may now reset your password.</ThemedText>
          </View>

          <View style={styles.form}>
            <TextField
              label="New Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
            {error ? (
              <ThemedText selectable style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
            <PrimaryButton
              label="Reset Password"
              onPress={handleReset}
              loading={loading}
              disabled={!password}
            />
          </View>
        </>
      )}
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 32, justifyContent: 'center' },
  header: { gap: 8 },
  form: { gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  error: { color: '#D0342C', fontSize: 14 },
});
