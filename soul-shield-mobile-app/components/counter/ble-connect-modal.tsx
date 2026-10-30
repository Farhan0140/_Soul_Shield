import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useSyncExternalStore } from 'react';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useLocale } from '@/context/locale-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  bleGetStatus,
  bleSubscribe,
  connectAndUse,
  disconnectBle,
  setActiveCounterTask,
  startBleScan,
  stopBleScan,
  type ActiveCounterTask,
  type BleStatus,
} from '@/lib/bluetooth/counter-ble';

interface BleConnectModalProps {
  visible: boolean;
  onClose: () => void;
  /** The counter task / sub-task of the page that opened this modal —
   * connecting makes THIS the active Bluetooth-controlled task (switching
   * away from any previously selected one, per the feature spec). */
  currentTask: ActiveCounterTask;
}

/** Scan → connect → select modal for ESP32 Bluetooth control (#esp32-bluetooth).
 * States: permission/Bluetooth-off notices → scanning (device list, strongest
 * signal first, filtered by the Soul Shield service UUID) → connecting →
 * connected (this task / switch to this task / disconnect). Auto-reconnect
 * after the first connect is handled by the BLE manager module. */
export function BleConnectModal({ visible, onClose, currentTask }: BleConnectModalProps) {
  const status: BleStatus = useSyncExternalStore(bleSubscribe, bleGetStatus, bleGetStatus);
  const { t } = useLocale();

  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const mutedColor = useThemeColor({}, 'muted');
  const tint = useThemeColor({}, 'tint');
  const successColor = useThemeColor({}, 'success');
  const dangerColor = useThemeColor({}, 'danger');
  const textColor = useThemeColor({}, 'text');

  // Scan while the modal is open (unless already connected); always stop the
  // scan when it closes.
  useEffect(() => {
    if (visible && status.phase !== 'connected') {
      void startBleScan();
    }
    if (!visible) {
      stopBleScan();
    }
    return () => {
      if (visible) stopBleScan();
    };
    // phase intentionally not a dep — starting/stopping scan follows open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isActiveThis =
    status.activeTask?.taskId === currentTask.taskId &&
    status.activeTask?.subTaskId === currentTask.subTaskId;
  const connectedToThis = status.phase === 'connected' && isActiveThis;

  const handleClose = () => {
    stopBleScan();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.card, { backgroundColor: cardColor, borderColor }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <IconSymbol name="b.circle.fill" size={20} color={tint} />
            <ThemedText type="defaultSemiBold" style={styles.title}>
              {t('ble.title')}
            </ThemedText>
            <Pressable onPress={handleClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <IconSymbol name="xmark" size={20} color={mutedColor} />
            </Pressable>
          </View>

          {/* Connected + active for THIS task */}
          {connectedToThis ? (
            <View style={styles.section}>
              <View
                style={[styles.connectedCard, { backgroundColor: `${successColor}14`, borderColor: `${successColor}33` }]}>
                <IconSymbol name="b.circle.fill" size={28} color={successColor} />
                <ThemedText type="defaultSemiBold" style={[styles.connectedLabel, { color: successColor }]}>
                  {t('ble.connected')}
                </ThemedText>
                <ThemedText style={[styles.connectedDevice, { color: mutedColor }]} numberOfLines={1}>
                  {status.deviceName ?? 'ESP32'}
                </ThemedText>
                <ThemedText style={[styles.hint, { color: mutedColor }]}>{t('ble.controllingThis')}</ThemedText>
              </View>
              <PrimaryButton
                label={t('ble.disconnect')}
                variant="destructive"
                onPress={() => void disconnectBle()}
              />
            </View>
          ) : null}

          {/* Connected, but controlling a DIFFERENT task → one-tap switch */}
          {status.phase === 'connected' && !isActiveThis ? (
            <View style={styles.section}>
              <ThemedText style={[styles.hint, { color: mutedColor }]}>{t('ble.currentlyOther')}</ThemedText>
              <PrimaryButton
                label={t('ble.switchToThis')}
                onPress={() => void setActiveCounterTask(currentTask)}
              />
            </View>
          ) : null}

          {/* Permission / Bluetooth-off notices */}
          {status.phase === 'unauthorized' ? (
            <ThemedText style={[styles.notice, { color: dangerColor }]}>{t('ble.denied')}</ThemedText>
          ) : null}
          {status.phase === 'unsupported' ? (
            // Expo Go cannot scan BLE (native module missing there) — a dev
            // build is required for the ESP32 feature.
            <ThemedText style={[styles.notice, { color: dangerColor }]}>
              {status.error === 'BLE_UNAVAILABLE_IN_EXPO_GO' ? t('ble.expoGo') : t('ble.turnOn')}
            </ThemedText>
          ) : null}
          {status.phase === 'poweredOff' ? (
            <ThemedText style={[styles.notice, { color: dangerColor }]}>{t('ble.turnOn')}</ThemedText>
          ) : null}

          {/* Connecting state */}
          {status.phase === 'connecting' ? (
            <ThemedText type="defaultSemiBold" style={{ color: tint, textAlign: 'center' }}>
              {t('ble.scanning')}
            </ThemedText>
          ) : null}

          {/* Idle or scanning → connect UI */}
          {status.phase === 'idle' || status.phase === 'scanning' ? (
            <View style={styles.section}>
              <ThemedText style={[styles.hint, { color: mutedColor }]}>{t('ble.connect.hint')}</ThemedText>
              {status.phase === 'scanning' ? (
                <ThemedText type="defaultSemiBold" style={{ color: tint }}>
                  {t('ble.scanning')}
                </ThemedText>
              ) : (
                <PrimaryButton label={t('ble.scan')} onPress={() => void startBleScan()} />
              )}

              {status.devices.length === 0 ? (
                <ThemedText style={[styles.noneFound, { color: mutedColor }]}>{t('ble.noneFound')}</ThemedText>
              ) : (
                <ScrollView style={styles.deviceList} nestedScrollEnabled>
                  {status.devices.map((device) => (
                    <Pressable
                      key={device.id}
                      onPress={() => void connectAndUse(device.id, currentTask)}
                      style={({ pressed }) => [
                        styles.deviceRow,
                        { borderColor, opacity: pressed ? 0.7 : 1 },
                      ]}>
                      <View style={styles.deviceText}>
                        <ThemedText type="defaultSemiBold" numberOfLines={1} style={{ color: textColor }}>
                          {device.name ?? '(unknown device)'}
                        </ThemedText>
                        <Text style={{ color: mutedColor, fontSize: 11 }}>RSSI {device.rssi}</Text>
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={mutedColor} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {status.error ? (
            <ThemedText selectable style={[styles.errorText, { color: dangerColor }]}>
              {getErrorMessageFriendly(status.error)}
            </ThemedText>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Module errors are already user-facing strings; this wrapper is the place
 * to silence connection-noise (e.g. spontaneous disconnect) later. */
function getErrorMessageFriendly(message: string): string {
  if (/disconnect/i.test(message)) return 'The ESP32 disconnected. Reconnect from this panel.';
  return message;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1 },
  section: { gap: 10 },
  connectedCard: {
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 14,
  },
  connectedLabel: { fontSize: 16 },
  connectedDevice: { fontSize: 12 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  notice: { fontSize: 13 },
  noneFound: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  deviceList: { maxHeight: 220, gap: 8 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    borderCurve: 'continuous',
    padding: 12,
  },
  deviceText: { flex: 1, gap: 1 },
  errorText: { fontSize: 12 },
});
