import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

function CloseButton() {
  const color = useThemeColor({}, 'text');
  return (
    <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
      <IconSymbol name="xmark" size={22} color={color} />
    </Pressable>
  );
}

export default function AccountLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <CloseButton /> }}>
      <Stack.Screen name="change-password" options={{ title: 'Change Password' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete Account' }} />
    </Stack>
  );
}
