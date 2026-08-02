import { router, Tabs, usePathname } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { CenterFabButton } from '@/components/ui/center-fab-button';
import { CreateActionSheet } from '@/components/ui/create-action-sheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NotificationBell } from '@/components/ui/notification-bell';
import { Colors } from '@/constants/theme';
import {
  TAB_BAR_BOTTOM_MARGIN,
  TAB_BAR_HEIGHT,
  TAB_BAR_MARGIN_HORIZONTAL,
  TAB_BAR_RADIUS,
} from '@/constants/tab-bar';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';

export default function TabLayout() {
  const { resolvedTheme } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const colors = Colors[resolvedTheme];
  const [sheetOpen, setSheetOpen] = useState(false);

  // The center "+" is a create action, not a screen — only meaningful on the
  // main task/dashboard view. Hidden everywhere else via Tabs.Protected, the
  // same mechanism already used for the admin-only tab, so the remaining
  // tabs redistribute evenly instead of leaving a blank gap.
  const pathname = usePathname();
  const showCenterFab = pathname === '/';

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: colors.tint,
          tabBarInactiveTintColor: colors.muted,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarItemStyle: { paddingTop: 6 },
          tabBarStyle: {
            position: 'absolute',
            left: TAB_BAR_MARGIN_HORIZONTAL,
            right: TAB_BAR_MARGIN_HORIZONTAL,
            bottom: insets.bottom + TAB_BAR_BOTTOM_MARGIN,
            height: TAB_BAR_HEIGHT,
            borderRadius: TAB_BAR_RADIUS,
            borderTopWidth: 0,
            backgroundColor: colors.card,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
              },
              android: { elevation: 10 },
            }),
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="calendar" color={color} />,
          }}
        />
        <Tabs.Protected guard={showCenterFab}>
          <Tabs.Screen
            name="create"
            options={{
              title: '',
              tabBarButton: () => <CenterFabButton onPress={() => setSheetOpen(true)} />,
            }}
          />
        </Tabs.Protected>
        <Tabs.Screen
          name="categories"
          options={{
            title: 'Categories',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="tag.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
          }}
        />
        <Tabs.Protected guard={user?.role === 'admin'}>
          <Tabs.Screen
            name="admin"
            options={{
              title: 'Admin',
              tabBarIcon: ({ color }) => <IconSymbol size={26} name="shield.fill" color={color} />,
            }}
          />
        </Tabs.Protected>
      </Tabs>
      <NotificationBell />
      <CreateActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreateTask={() => {
          setSheetOpen(false);
          router.push('/task/new');
        }}
        onCreateCategory={() => {
          setSheetOpen(false);
          router.push('/category/new');
        }}
      />
    </>
  );
}
