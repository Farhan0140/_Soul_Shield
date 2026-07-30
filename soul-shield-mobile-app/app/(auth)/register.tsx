import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { register } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { getErrorMessage } from '@/lib/errors';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedAnswer = securityAnswer.trim();
  const answerValid = trimmedAnswer.length >= 3 && trimmedAnswer.length <= 100;

  const handleSubmit = async () => {
    setError(null);
    if (!answerValid) {
      setError('Your security answer must be between 3 and 100 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, securityAnswer: trimmedAnswer });
      router.replace('/(auth)/login');
    } catch (err) {
      setError(getErrorMessage(err, 'register'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="title">Create Account</ThemedText>
        <ThemedText type="default">Enter your details to get started.</ThemedText>
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
        <TextField label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
        <TextField
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />
        <View style={styles.securityAnswerField}>
          <TextField
            label="Security Verification Answer"
            value={securityAnswer}
            onChangeText={setSecurityAnswer}
            placeholder="Please enter a personal answer that you will always remember."
            autoCapitalize="none"
          />
          <ThemedText type="default" style={styles.helpText}>
            This can be your nickname, your favorite thing, your pet&apos;s name, your father&apos;s name, your
            mother&apos;s name, your favorite place, or any personal word or phrase that only you know. You&apos;ll be
            asked for this answer if you ever need to reset your password. Choose something memorable but difficult
            for others to guess.
          </ThemedText>
        </View>
        {error ? (
          <ThemedText selectable style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton
          label="Create Account"
          onPress={handleSubmit}
          loading={loading}
          disabled={!email.trim() || !name.trim() || !password || !answerValid}
        />
      </View>
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 32, justifyContent: 'center' },
  header: { gap: 8 },
  form: { gap: 16 },
  securityAnswerField: { gap: 6 },
  helpText: { fontSize: 12, opacity: 0.7 },
  error: { color: '#D0342C', fontSize: 14 },
});
