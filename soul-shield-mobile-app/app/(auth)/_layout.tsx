import { Stack } from 'expo-router';

import { themeScreenLayout } from '@/components/ui/theme-backdrop';

export const unstable_settings = {
  anchor: 'login',
};

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} screenLayout={themeScreenLayout}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
