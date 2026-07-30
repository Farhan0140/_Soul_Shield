import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { Fab } from '@/components/ui/fab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NotificationBell } from '@/components/ui/notification-bell';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { FabProvider } from '@/context/fab-context';
import { SyncNotificationsProvider } from '@/context/sync-notifications-context';
import { useAppTheme } from '@/context/theme-context';

export default function TabLayout() {
  const { resolvedTheme } = useAppTheme();
  const { user } = useAuth();

  return (
    <SyncNotificationsProvider>
      <FabProvider>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: Colors[resolvedTheme].tint,
            headerShown: false,
            tabBarButton: HapticTab,
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              title: 'History',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
            }}
          />
          <Tabs.Screen
            name="categories"
            options={{
              title: 'Categories',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="tag.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
            }}
          />
          <Tabs.Protected guard={user?.role === 'admin'}>
            <Tabs.Screen
              name="admin"
              options={{
                title: 'Admin',
                tabBarIcon: ({ color }) => <IconSymbol size={28} name="shield.fill" color={color} />,
              }}
            />
          </Tabs.Protected>
        </Tabs>
        <Fab />
        <NotificationBell />
      </FabProvider>
    </SyncNotificationsProvider>
  );
}
