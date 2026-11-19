import { Stack } from 'expo-router';

import { themeScreenLayout } from '@/components/ui/theme-backdrop';

export const unstable_settings = {
  anchor: 'tasks',
};

export default function AdminLayout() {
  return (
    <Stack screenLayout={themeScreenLayout}>
      <Stack.Screen name="tasks" options={{ title: 'Admin Panel' }} />
    </Stack>
  );
}
