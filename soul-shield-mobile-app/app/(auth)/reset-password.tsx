import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { resetPassword } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { getErrorMessage } from '@/lib/errors';

export default function ResetPasswordScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email.trim(), password);
      router.replace('/(auth)/login');
    } catch (err) {
      setError(getErrorMessage(err, 'reset-password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">Reset Password</ThemedText>
        <ThemedText type="default">Enter your email and choose a new password.</ThemedText>
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
          onPress={handleSubmit}
          loading={loading}
          disabled={!email.trim() || !password}
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
