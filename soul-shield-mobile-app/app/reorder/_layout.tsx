import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

function CloseButton() {
  const color = useThemeColor({}, 'text');
  return (
    <Pressable onPress={() => router.back()} hitSlop={8}>
      <IconSymbol name="xmark" size={22} color={color} />
    </Pressable>
  );
}

export default function ReorderLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <CloseButton /> }}>
      <Stack.Screen name="index" options={{ title: 'Reorder' }} />
      <Stack.Screen name="categories" options={{ title: 'Reorder Categories' }} />
      <Stack.Screen name="tasks" options={{ title: 'Reorder Tasks' }} />
      <Stack.Screen name="subtasks" options={{ title: 'Reorder Sub-Tasks' }} />
    </Stack>
  );
}
