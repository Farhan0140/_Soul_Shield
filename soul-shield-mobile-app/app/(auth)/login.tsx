import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/lib/errors';
import { rememberedEmailStore } from '@/lib/secure-store';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    rememberedEmailStore.get().then((saved) => {
      if (saved) setEmail(saved);
    });
  }, []);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      await login(trimmedEmail, password);
      rememberedEmailStore.set(trimmedEmail);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">SoulShield</ThemedText>
        <ThemedText type="default">Log in to continue your journey.</ThemedText>
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
          label="Password"
          secureTextEntry
          autoComplete="password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />
        {error ? (
          <ThemedText selectable style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton label="Log In" onPress={handleLogin} loading={loading} />
      </View>

      <View style={styles.footer}>
        <Link href={{ pathname: '/(auth)/request-otp', params: { flow: 'reset' } }}>
          <ThemedText type="link">Forgot password?</ThemedText>
        </Link>
        <Link href={{ pathname: '/(auth)/request-otp', params: { flow: 'register' } }}>
          <ThemedText type="link">Create an account</ThemedText>
        </Link>
      </View>
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 32, justifyContent: 'center' },
  header: { gap: 8 },
  form: { gap: 16 },
  footer: { gap: 12, alignItems: 'center' },
  error: { color: '#D0342C', fontSize: 14 },
});
