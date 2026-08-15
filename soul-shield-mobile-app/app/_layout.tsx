import { ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import 'react-native-reanimated';

import { runForegroundSyncIfDue } from '@/lib/background-sync/sync';
import { registerBackgroundSync } from '@/lib/background-sync/task';
import { ensureTimerNotificationChannel } from '@/lib/timer/notifications';
import { ensureTimerTaskNotificationChannel } from '@/lib/timer-task/notifications';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { SyncNotificationsProvider } from '@/context/sync-notifications-context';
import { AppThemeProvider, useAppTheme } from '@/context/theme-context';
import { ThemeScheme } from '@/constants/theme';
import { ARABIC_FONT_FAMILY } from '@/lib/arabic';
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
        <Stack.Screen name="task" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="category" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="counter" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen
          name="sync-notifications"
          options={{ presentation: 'modal', title: 'Sync Issues' }}
        />
        <Stack.Screen name="timer" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="timer-task" options={{ presentation: 'modal', headerShown: false }} />
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
  // Registered once here so every ThemedText in the app can reference it by
  // name (see components/themed-text.tsx's Arabic-script auto-detection) —
  // gating the initial render on this (same pattern as the auth-loading
  // spinner below) avoids a flash of the wrong font on any text that needs
  // it before the local asset finishes registering.
  const [fontsLoaded] = useFonts({
    [ARABIC_FONT_FAMILY]: require('@/assets/fonts/KFGQPCUthmanTahaNaskh-Regular.ttf'),
  });

  useEffect(() => {
    ensureNotificationSetup();
    ensureTimerNotificationChannel();
    ensureTimerTaskNotificationChannel();
    registerBackgroundSync();

    // "Fetch today + the next couple of days whenever I open the app with a
    // connection" (see lib/background-sync/sync.ts) needs a trigger beyond
    // the once-a-day scheduled task and reconnect catch-up: a cold launch or
    // a resume from background while already online is neither of those.
    runForegroundSyncIfDue(queryClient);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runForegroundSyncIfDue(queryClient);
    });

    // Tapping a Timer Task notification (running or completion) opens its
    // dedicated page directly — that page's useTaskTimer mount effect then
    // does the actual reconciliation (finalizing completion if the duration
    // was reached while backgrounded), the same path a normal app-reopen
    // already takes, so no separate completion handling is needed here.
    const notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { type?: string; taskId?: number; subTaskId?: number | null; date?: string }
        | undefined;
      if (data?.type !== 'timer-task' || data.taskId == null) return;
      router.push({
        pathname: '/timer-task/[taskId]',
        params: {
          taskId: String(data.taskId),
          ...(data.subTaskId != null ? { subTaskId: String(data.subTaskId) } : {}),
          ...(data.date ? { date: data.date } : {}),
        },
      });
    });

    return () => {
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
