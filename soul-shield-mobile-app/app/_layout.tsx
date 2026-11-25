import { ThemeProvider } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

import { runForegroundSyncIfDue } from '@/lib/background-sync/sync';
import { invalidateTaskListsIfDayChanged } from '@/lib/task-cache';
// The background task definitions themselves load from index.ts (they must
// exist on headless launches too); this only schedules the daily sync.
import { registerBackgroundSync } from '@/lib/background-sync/task';
import { clearRemovedTimerLeftovers } from '@/lib/timer/notifications';
import { ensureTimerTaskNotificationChannel } from '@/lib/timer-task/notifications';
import { ArabicFontProvider } from '@/context/arabic-font-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { LocaleProvider } from '@/context/locale-context';
import { SyncNotificationsProvider } from '@/context/sync-notifications-context';
import { AppThemeProvider, useAppTheme } from '@/context/theme-context';
import { ThemeScheme } from '@/constants/theme';
import { HAND_FONT_ASSETS, HAND_FONTS } from '@/constants/ui-style';
import { themeScreenLayout } from '@/components/ui/theme-backdrop';
import { ARABIC_FONT_OPTIONS } from '@/lib/arabic';
import { OnboardingModal } from '@/components/onboarding/onboarding-modal';
// Side effect: initializes the ESP32 Bluetooth manager (state subscription)
// and auto-reconnects to the paired counter device after launch.
import { bootBluetooth } from '@/lib/bluetooth/counter-ble';
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
    // The app works without an account (guest mode): every screen is open
    // to everyone. Only signing in/up and the account settings depend on
    // the auth state - sign-in opens on top of the app from Profile, and
    // closes by itself once the user is signed in (its guard turns false).
    <Stack screenLayout={themeScreenLayout}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="task" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="category" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="reorder" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="counter" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen
        name="sync-notifications"
        options={{ presentation: 'modal', title: 'Sync Issues' }}
      />
      <Stack.Screen name="insights" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="search" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="archived" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="shop" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="timer-task" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="(auth)" options={{ presentation: 'modal', headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="account" options={{ presentation: 'modal', headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function ThemedApp() {
  const { resolvedTheme, palette, styleTokens } = useAppTheme();
  const navigationTheme = useMemo(
    () => getNavigationTheme(resolvedTheme, palette, styleTokens.handDrawn ? HAND_FONTS.body : undefined),
    [resolvedTheme, palette, styleTokens.handDrawn]
  );

  return (
    <ThemeProvider value={navigationTheme}>
      <SyncNotificationsProvider>
        <RootNavigator />
        <OnboardingModal />
      </SyncNotificationsProvider>
      <StatusBar style={ThemeScheme[resolvedTheme] === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Every bundled Arabic font is registered once here, up front — not just
  // whichever one is currently selected — so switching the preference in
  // Profile (see context/arabic-font-context.tsx) is an instant re-render,
  // not another async font load. Gating the initial render on this (same
  // pattern as the auth-loading spinner below) avoids a flash of the wrong
  // font on any text that needs it before the assets finish registering.
  // The Paper/Pencil UI styles' handwritten fonts (constants/ui-style.ts)
  // register here too, for the same instant-switch reason.
  const [fontsLoaded] = useFonts({
    ...Object.fromEntries(ARABIC_FONT_OPTIONS.map((option) => [option.familyName, option.asset])),
    ...HAND_FONT_ASSETS,
  });

  useEffect(() => {
    ensureNotificationSetup();
    clearRemovedTimerLeftovers();
    ensureTimerTaskNotificationChannel();
    registerBackgroundSync();
    bootBluetooth();

    // "Fetch today + the next couple of days whenever I open the app with a
    // connection" (see lib/background-sync/sync.ts) needs a trigger beyond
    // the once-a-day scheduled task and reconnect catch-up: a cold launch or
    // a resume from background while already online is neither of those.
    runForegroundSyncIfDue(queryClient);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      invalidateTaskListsIfDayChanged(queryClient);
      runForegroundSyncIfDue(queryClient);
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
    // Cross-device "data-change" pushes are data-only, so they never reach
    // a listener here: they run lib/background-sync/data-change-task.ts.

    return () => {
      appStateSubscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    // React Navigation's setup requires a GestureHandlerRootView ancestor
    // for its own gesture-driven screen transitions, so it goes at the very
    // root here.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Tracks the on-screen keyboard so focused inputs stay visible above
          it on every screen and sheet (see components/ui/
          keyboard-avoiding-scroll-view.tsx for why it's needed). */}
      <KeyboardProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => {
          queryClient.resumePausedMutations();
        }}>
        <ArabicFontProvider>
          <AppThemeProvider>
            <LocaleProvider>
              <AuthProvider>
                <ThemedApp />
              </AuthProvider>
            </LocaleProvider>
          </AppThemeProvider>
        </ArabicFontProvider>
      </PersistQueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
