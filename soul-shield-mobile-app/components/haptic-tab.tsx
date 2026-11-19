import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { ThemeDecor } from '@/components/ui/theme-decor';
import { useUIStyle } from '@/hooks/use-ui-style';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { uiStyle, palette } = useUIStyle();
  const selected = !!props.accessibilityState?.selected;

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}>
      {/* Pencil only: the active tab is hatched, like the reference
          wireframe's active nav item. */}
      {uiStyle === 'pencil' && selected ? (
        <View pointerEvents="none" style={styles.activeMark}>
          <ThemeDecor kind="chip" stroke={palette.tint} hatch={palette.tint} hatchSpacing={6} hatchWidth={1} />
        </View>
      ) : null}
      {props.children}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  activeMark: { position: 'absolute', top: 5, bottom: 5, left: 4, right: 4 },
});
