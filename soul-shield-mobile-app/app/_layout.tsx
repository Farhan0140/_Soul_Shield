import { ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { registerBackgroundSync } from '@/lib/background-sync/task';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { SyncNotificationsProvider } from '@/context/sync-notifications-context';
import { AppThemeProvider, useAppTheme } from '@/context/theme-context';
import { ThemeScheme } from '@/constants/theme';
import '@/lib/network';
import { getNavigationTheme } from '@/lib/navigation-theme';
import { ensureNotificationSetup } from '@/lib/notifications';
import { persistOptions } from '@/lib/persister';
import { queryClient } from '@/lib/query-client';

function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task" options={{ presentation: 'modal' }} />
        <Stack.Screen name="category" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="sync-notifications"
          options={{ presentation: 'modal', title: 'Sync Issues' }}
        />
      </Stack.Protected>
    </Stack>
  );
}

function ThemedApp() {
  const { resolvedTheme } = useAppTheme();

  return (
    <ThemeProvider value={getNavigationTheme(resolvedTheme)}>
      <SyncNotificationsProvider>
        <RootNavigator />
      </SyncNotificationsProvider>
      <StatusBar style={ThemeScheme[resolvedTheme] === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    ensureNotificationSetup();
    registerBackgroundSync();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        queryClient.resumePausedMutations();
      }}>
      <AppThemeProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </AppThemeProvider>
    </PersistQueryClientProvider>
  );
}
