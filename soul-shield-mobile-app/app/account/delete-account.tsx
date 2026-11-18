import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { deleteAccount } from '@/api/auth';
import { ThemedText } from '@/components/themed-text';
import { KeyboardAvoidingScrollView } from '@/components/ui/keyboard-avoiding-scroll-view';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getErrorMessage } from '@/lib/errors';

export default function DeleteAccountScreen() {
  const { token, user, logout } = useAuth();
  const mutedColor = useThemeColor({}, 'muted');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performDelete = async () => {
    setError(null);
    setLoading(true);
    try {
      await deleteAccount(password, token);
    } catch (err) {
      setError(getErrorMessage(err, 'delete-account'));
      setLoading(false);
      return;
    }
    // The server copy is gone; wipe everything on this device too (local
    // database, queued changes, reminders) and return to the login screen.
    await logout();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and all of your tasks, categories and history on every device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Forever', style: 'destructive', onPress: () => void performDelete() },
      ]
    );
  };

  return (
    <KeyboardAvoidingScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ThemedText type="subtitle">This can&apos;t be undone</ThemedText>
        <ThemedText>
          Deleting <ThemedText type="defaultSemiBold">{user?.email}</ThemedText> permanently removes your account and
          everything in it: tasks, sub-tasks, categories, completion history and Quran bookmarks, on all of your
          devices.
        </ThemedText>
        <ThemedText style={{ color: mutedColor }}>
          Tip: use Profile → Data → Export My Data first if you want a copy.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextField
          label="Confirm with your password"
          secureTextEntry
          autoComplete="current-password"
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
          label="Delete My Account"
          variant="destructive"
          onPress={handleDelete}
          loading={loading}
          disabled={!password}
        />
      </View>
    </KeyboardAvoidingScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, gap: 24 },
  header: { gap: 10 },
  form: { gap: 16 },
  error: { color: '#D0342C', fontSize: 14 },
});
