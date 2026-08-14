import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface FingerprintIncrementButtonProps {
  /** Fires the exact same +1 increment as the main button — a successful
   * scan calls this directly, it never simulates a tap on another control
   * and never performs a different kind of increment. */
  onIncrement: () => void;
  disabled?: boolean;
}

/** Real device fingerprint sensor (Touch ID on iOS, the fingerprint/
 * biometric prompt on Android) as an alternate +1 trigger — tapping this
 * icon invokes the OS biometric prompt via expo-local-authentication; only a
 * successful scan calls onIncrement(). Devices with no enrolled biometric
 * hardware have nothing to scan, so the tap itself is treated as the
 * confirmation there instead of blocking the control entirely. */
export function FingerprintIncrementButton({ onIncrement, disabled }: FingerprintIncrementButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const [scanning, setScanning] = useState(false);

  const handlePress = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const [hasHardware, isEnrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      if (!hasHardware || !isEnrolled) {
        if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onIncrement();
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Scan to add 1' });
      if (result.success) {
        onIncrement();
      }
    } finally {
      setScanning(false);
    }
  }, [scanning, onIncrement]);

  return (
    <Pressable
      disabled={disabled || scanning}
      onPress={handlePress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Scan fingerprint to add 1"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: card,
          borderColor: border,
          opacity: disabled ? 0.5 : pressed || scanning ? 0.7 : 1,
        },
      ]}>
      <IconSymbol name="touchid" size={32} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
