import { Stack } from 'expo-router';

export const unstable_settings = {
  anchor: 'tasks',
};

export default function AdminLayout() {
  return (
    <Stack>
      <Stack.Screen name="tasks" options={{ title: 'Admin Panel' }} />
    </Stack>
  );
}
