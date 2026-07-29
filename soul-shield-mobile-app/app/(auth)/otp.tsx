import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { sendOtp, verifyOtp } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { getErrorMessage } from '@/lib/errors';

export default function OtpScreen() {
  const { email, flow } = useLocalSearchParams<{ email: string; flow: 'register' | 'reset' }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, otp.trim());
      if (flow === 'register') {
        router.replace({ pathname: '/(auth)/register', params: { email } });
      } else {
        router.replace({ pathname: '/(auth)/reset-password', params: { email } });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResending(true);
    try {
      await sendOtp(email);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">Verify Email</ThemedText>
        <ThemedText type="default">
          Enter the 6-digit code we sent to {email}. It expires in 5 minutes.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Verification Code"
          keyboardType="number-pad"
          maxLength={6}
          value={otp}
          onChangeText={setOtp}
          placeholder="123456"
        />
        {error ? (
          <ThemedText selectable style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton label="Verify" onPress={handleVerify} loading={loading} disabled={otp.length < 6} />
        <PrimaryButton
          label="Resend Code"
          variant="secondary"
          onPress={handleResend}
          loading={resending}
        />
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
