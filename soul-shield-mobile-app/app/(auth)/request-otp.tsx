import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { sendOtp } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { getErrorMessage } from '@/lib/errors';

export default function RequestOtpScreen() {
  const { flow } = useLocalSearchParams<{ flow: 'register' | 'reset' }>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = flow === 'register';

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await sendOtp(email.trim());
      router.push({ pathname: '/(auth)/otp', params: { email: email.trim(), flow } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">{isRegister ? 'Create Account' : 'Reset Password'}</ThemedText>
        <ThemedText type="default">
          Enter your email and we&apos;ll send you a 6-digit verification code.
        </ThemedText>
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
        <PrimaryButton label="Send Code" onPress={handleSubmit} loading={loading} disabled={!email.trim()} />
      </View>
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 32, justifyContent: 'center' },
  header: { gap: 8 },
  form: { gap: 16 },
  error: { color: '#D0342C', fontSize: 14 },
});
