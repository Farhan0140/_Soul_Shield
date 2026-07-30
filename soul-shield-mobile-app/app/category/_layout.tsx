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

export default function CategoryLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <CloseButton /> }}>
      <Stack.Screen name="new" options={{ title: 'New Category' }} />
    </Stack>
  );
}
