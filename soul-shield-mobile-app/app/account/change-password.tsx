import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { changePassword } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { getErrorMessage } from '@/lib/errors';

import { PASSWORD_MAX_BYTES as MAX_PASSWORD_LENGTH, PASSWORD_MIN as MIN_PASSWORD_LENGTH, validateNewPassword } from '@/lib/validation';

export default function ChangePasswordScreen() {
  const { token, replaceToken } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validationError = (): string | null => {
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) return passwordError;
    if (newPassword !== confirmPassword) return "The new passwords don't match.";
    if (newPassword === currentPassword) return 'Choose a password different from your current one.';
    return null;
  };

  const handleSubmit = async () => {
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword, token);
      if (result?.token) await replaceToken(result.token);
      Alert.alert('Password updated', 'Other devices have been signed out. Use your new password the next time you log in.');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'change-password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <ThemedText type="default">
        Enter your current password, then choose a new one ({MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters).
      </ThemedText>

      <View style={styles.form}>
        <TextField
          label="Current Password"
          secureTextEntry
          autoComplete="current-password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••••"
        />
        <TextField
          label="New Password"
          secureTextEntry
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••••"
        />
        <TextField
          label="Confirm New Password"
          secureTextEntry
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
        />
        {error ? (
          <ThemedText selectable style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton
          label="Update Password"
          onPress={handleSubmit}
          loading={loading}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        />
      </View>
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 24 },
  form: { gap: 16 },
  error: { color: '#D0342C', fontSize: 14 },
});
