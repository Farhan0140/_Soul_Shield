import { ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/context/auth-context';
import { AppThemeProvider, useAppTheme } from '@/context/theme-context';
import { getNavigationTheme } from '@/lib/navigation-theme';
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
      </Stack.Protected>
    </Stack>
  );
}

function ThemedApp() {
  const { resolvedTheme } = useAppTheme();

  return (
    <ThemeProvider value={getNavigationTheme(resolvedTheme)}>
      <RootNavigator />
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
