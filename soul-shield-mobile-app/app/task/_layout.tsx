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

export default function TaskLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <CloseButton /> }}>
      <Stack.Screen name="new" options={{ title: 'New Task' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit Task' }} />
    </Stack>
  );
}
