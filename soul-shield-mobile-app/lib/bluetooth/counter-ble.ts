import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { BleManager, type Subscription } from 'react-native-ble-plx';

import { hapticLight } from '@/lib/feedback';
import {
  incrementSubTaskCompletionLocal,
  incrementTaskCompletionLocal,
} from '@/lib/db/completions-repo';
import { getTaskByUuid } from '@/lib/db/tasks-repo';
import { getSubTaskByUuid } from '@/lib/db/sub-tasks-repo';
import { patchSubTaskIncrementInCaches, patchTaskInCaches } from '@/lib/task-cache';
import { todayISODate } from '@/lib/date';
import { queryClient } from '@/lib/query-client';
import { getErrorMessage } from '@/lib/errors';
import { incrementSubTaskMutationFn, incrementTaskMutationFn } from '@/lib/mutation-defaults';

/**
 * ESP32 BLE control for Counter Tasks / Counter Sub-Tasks (#esp32-bluetooth).
 *
 * The ESP32 (Framework/esp32 project) advertises SERVICE_UUID; the app scans,
 * connects once (picker in the counter page's Bluetooth modal), subscribes to
 * the TX characteristic, and receives a one-byte "1" per physical button
 * press. Each press runs the EXACT same increment pipeline as a manual +1:
 *   synchronous local SQLite write → optimistic cache patch → background
 *   additive push (op:"increment"), untouched by this module's specifics.
 *
 * Design constraints:
 *  - HEADLESS-SAFE: presses must still work while the app is backgrounded /
 *    screen locked (simple-background mode — as long as the OS hasn't killed
 *    the process). So no React context is used; decrements/toggles are never
 *    triggered here, only increments; the active task + paired device persist
 *    in AsyncStorage for auto-reconnect after relaunch.
 *  - ONE active task at a time: selecting Bluetooth control on a counter page
 *    replaces the active task ("switch Bluetooth control between tasks").
 *  - The paired device is remembered; auto-reconnect happens via
 *    ble-plx `autoConnect: true` + explicit reconnect on launch.
 *
 * NOT for: Bluetooth Classic (ESP32-C3 has none), pairing other device types.
 */

// --- BLE identity — MUST match Framework/src/main.cpp -------------------
const SERVICE_UUID = '9f83f3d0-8f5f-4a3f-9a1d-2c6a8f4e5b01';
const CHAR_TX_UUID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const DEVICE_STORE_KEY = 'soulshield_ble_device';
const ACTIVE_TASK_STORE_KEY = 'soulshield_ble_active_task';

// ---------------------------------------------------------------------------

export type BlePhase =
  | 'idle'
  | 'unsupported'
  | 'poweredOff'
  | 'unauthorized'
  | 'scanning'
  | 'connecting'
  | 'connected';

export interface BleStatus {
  phase: BlePhase;
  /** Human-readable name of the connected device (null = none). */
  deviceName: string | null;
  /** Last human-relevant error (connection, permissions; null otherwise). */
  error: string | null;
  /** Devices found during scanning, strongest signal first. */
  devices: { id: string; name: string | null; rssi: number }[];
  /** The task Bluetooth control currently INCREMENTS. */
  activeTask: ActiveCounterTask | null;
}

export interface ActiveCounterTask {
  taskId: string;
  subTaskId: string | null;
  /** Display title (for "currently controlling: X" in the modal). */
  title: string;
}

interface InternalState extends BleStatus {
  /** Persisted paired device for auto-reconnect. */
  pairedDeviceId: string | null;
  monitoring: Subscription | null;
}

let state: InternalState = {
  phase: 'idle',
  deviceName: null,
  error: null,
  devices: [],
  activeTask: null,
  pairedDeviceId: null,
  monitoring: null,
};

const listeners = new Set<() => void>();
let manager: BleManager | null = null;
let initialized = false;

function blePublic(s: InternalState): BleStatus {
  return {
    phase: s.phase,
    deviceName: s.deviceName,
    error: s.error,
    devices: s.devices,
    activeTask: s.activeTask,
  };
}

let publicSnapshot: BleStatus = blePublic(state);

function notify(): void {
  // Rebuild the public snapshot ONLY here — useSyncExternalStore requires
  // getSnapshot to return a STABLE reference between store changes, or React
  // re-renders forever ("Maximum update depth exceeded").
  publicSnapshot = blePublic(state);
  listeners.forEach((l) => l());
}

function replace(patch: Partial<InternalState>): void {
  state = { ...state, ...patch };
  notify();
}

/** EXPO_GO sentinel for error matching in the UI (see the modal's notice). */
export const BLE_ERROR_EXPO_GO = 'BLE_UNAVAILABLE_IN_EXPO_GO';

/** Returns the native BleManager, or null when the native module isn't in
 * the running binary — i.e. Expo Go, which cannot scan BLE at all (the
 * config-plugin permissions and the native code only exist in a development
 * build, like every other native module this app uses). */
function getManager(): BleManager | null {
  if (manager) return manager;
  try {
    manager = new BleManager();
    return manager;
  } catch {
    replace({ phase: 'unsupported', error: BLE_ERROR_EXPO_GO });
    return null;
  }
}

// --- React bridge ----------------------------------------------------------

export function bleSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function bleGetStatus(): BleStatus {
  return publicSnapshot;
}

export function useBleStatus(): BleStatus {
  return useSyncExternalStore(bleSubscribe, bleGetStatus, bleGetStatus);
}

// --- persistence -----------------------------------------------------------

async function loadPersisted(): Promise<void> {
  await Promise.all([
    (async () => {
      const raw = await AsyncStorage.getItem(ACTIVE_TASK_STORE_KEY);
      if (raw) {
        try {
          replace({ activeTask: JSON.parse(raw) as ActiveCounterTask });
        } catch {
          // ignore corrupt data
        }
      }
    })(),
    (async () => {
      const raw = await AsyncStorage.getItem(DEVICE_STORE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { id: string; name?: string | null };
          replace({ pairedDeviceId: parsed.id, deviceName: parsed.name ?? state.deviceName });
        } catch {
          // ignore corrupt data
        }
      }
    })(),
  ]);
}

async function persistPairedDevice(id: string | null, name?: string | null): Promise<void> {
  if (id == null) await AsyncStorage.removeItem(DEVICE_STORE_KEY);
  else
    await AsyncStorage.setItem(
      DEVICE_STORE_KEY,
      JSON.stringify({ id, name: name ?? null })
    );
}

// --- module init (imported for side effect in app/_layout.tsx) -------------

export function bootBluetooth(): void {
  if (initialized) return;
  initialized = true;
  void loadPersisted().then(() => {
    reconnectIfPaired().catch(() => {});
  });
}

// --- connection lifecycle --------------------------------------------------

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    // Android 12+ (API 31): near-by-devices BLE permissions.
    // Android 11- : BLE scanning is gated by location permission instead
    // (BLUETOOTH_SCAN/CONNECT don't exist there). Explicit literal strings —
    // bulletproof regardless of RN's constant table. ONE at a time: Android's
    // runtime dialog queue misbehaves when requests race in parallel.
    const wanted =
      Platform.Version >= 31
        ? ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT']
        : ['android.permission.ACCESS_FINE_LOCATION'];

    for (const permission of wanted) {
      const already = await PermissionsAndroid.check(permission as never);
      if (already) continue;
      const result = await PermissionsAndroid.request(permission as never, {
        title: 'Bluetooth control',
        message: 'Soul Shield needs Bluetooth to connect to your ESP32 counter button.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Starts a filtered scan for Soul Shield ESP32 devices (requires the
 * counter-page Bluetooth modal to be open; call stopScan on close). Android
 * runtime permissions are requested here. */
export async function startBleScan(): Promise<void> {
  const granted = await requestAndroidPermissions();
  if (!granted) {
    replace({ phase: 'unauthorized', error: 'Bluetooth permission denied' });
    return;
  }

  const manager = getManager();
  if (!manager) return; // Expo Go — unsupported phase already set

  const bleState = await manager.state().catch(() => 'Unknown');
  if (bleState !== 'PoweredOn') {
    replace({ phase: bleState === 'Unsupported' ? 'unsupported' : 'poweredOff' });
    return;
  }

  replace({ phase: 'scanning', devices: [], error: null });
  manager.startDeviceScan([SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
    if (error) {
      replace({ phase: 'idle', error: error.message });
      return;
    }
    if (!device) return;
    setDevicesUpsert({ id: device.id, name: device.localName ?? device.name ?? null, rssi: device.rssi ?? 0 });
  });
}

function setDevicesUpsert(device: { id: string; name: string | null; rssi: number }): void {
  const devices = [...state.devices.filter((d) => d.id !== device.id), device].sort(
    (a, b) => b.rssi - a.rssi
  );
  replace({ devices });
}

export function stopBleScan(): void {
  if (state.phase === 'scanning') replace({ phase: 'idle' });
  const manager = getManager();
  if (!manager) return;
  try {
    manager.stopDeviceScan();
  } catch {
    // scan already stopped
  }
}

/** Connects to a scanned/paired device and — on success — makes `task` the
 * ACTIVE Bluetooth-controlled task (switching away from any previous one). */
export async function connectAndUse(deviceId: string, task: ActiveCounterTask): Promise<void> {
  replace({ phase: 'connecting', error: null, activeTask: task });
  await persistActiveTask(task);
  const manager = getManager();
  if (!manager) return; // Expo Go — unsupported phase already set
  try {
    await manager.connectToDevice(deviceId, { autoConnect: true });
    await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);
    stopBleScan();
  } catch (error) {
    replace({ phase: 'idle', error: getErrorMessage(error) });
    return;
  }
  const name =
    state.devices.find((d) => d.id === deviceId)?.name ??
    state.deviceName ??
    'SoulShield-ESP32';
  await persistPairedDevice(deviceId, name);
  armMonitoring(deviceId);
  replace({ phase: 'connected', deviceName: name, error: null });
}

function armMonitoring(deviceId: string): void {
  const manager = getManager();
  if (!manager) return;
  state.monitoring = manager.monitorCharacteristicForDevice(
    deviceId,
    SERVICE_UUID,
    CHAR_TX_UUID,
    (error, characteristic) => {
      if (error) {
        // Connection dropped (walked out of range / phone toggled BT off).
        state.monitoring?.remove();
        state.monitoring = null;
        replace({ phase: 'idle', error: error.message });
        return;
      }
      const raw = characteristic?.value;
      if (!raw) return;
      // Any non-empty payload counts as one press ("1" from our firmware).
      handleEspButtonPress();
    }
  );
}

/** Launch-time auto-reconnect: only when a paired device AND an active task
 * were persisted (silently skips when Bluetooth is off/unavailable — the
 * modal can always reconnect manually). */
export async function reconnectIfPaired(): Promise<void> {
  if (!state.pairedDeviceId || !state.activeTask) return;
  const manager = getManager();
  if (!manager) return;
  const bleState = await manager.state().catch(() => 'Unknown');
  if (bleState !== 'PoweredOn') return;
  const deviceId = state.pairedDeviceId;
  replace({ phase: 'connecting' });
  try {
    await manager.connectToDevice(deviceId, { autoConnect: true });
    await manager.discoverAllServicesAndCharacteristicsForDevice(deviceId);
    armMonitoring(deviceId);
    replace({ phase: 'connected' });
  } catch {
    // Device out of range / not powered yet — user can reconnect via the modal.
    replace({ phase: 'idle' });
  }
}

export async function disconnectBle(): Promise<void> {
  state.monitoring?.remove();
  state.monitoring = null;
  const manager = getManager();
  if (state.pairedDeviceId && manager) {
    await manager.cancelDeviceConnection(state.pairedDeviceId).catch(() => {});
  }
  replace({ phase: 'idle' });
}

// --- active task -----------------------------------------------------------

/** Switches Bluetooth control to a different counter task/sub-task (requires
 * requirement: only the selected task is affected by button presses). */
export async function setActiveCounterTask(task: ActiveCounterTask): Promise<void> {
  replace({ activeTask: task });
  await persistActiveTask(task);
}

async function persistActiveTask(task: ActiveCounterTask): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_TASK_STORE_KEY, JSON.stringify(task));
}

export function isActiveCounterTask(taskId: string, subTaskId: string | null): boolean {
  const active = state.activeTask;
  return !!active && active.taskId === taskId && active.subTaskId === subTaskId;
}

// --- dispatch: one ESP32 press == +1 on the active task --------------------

function handleEspButtonPress(): void {
  const task = state.activeTask;
  if (!task || state.phase !== 'connected') return;
  const date = todayISODate();
  hapticLight();

  if (task.subTaskId) {
    const subTask = getSubTaskByUuid(task.subTaskId);
    const targetCount = subTask?.targetCount ?? 0;
    const local = incrementSubTaskCompletionLocal(task.subTaskId, task.taskId, date, 1, targetCount);
    if (!local.completionUuid) return;
    // Same optimistic cache patch the +1 button uses → instant UI everywhere.
    patchSubTaskIncrementInCaches(queryClient, {
      date,
      taskId: task.taskId,
      subTaskId: task.subTaskId,
      amount: 1,
      targetCount,
    });
    // Background push — same additive delta the +1 button sends.
    void incrementSubTaskMutationFn({ completionUuid: local.completionUuid, amount: 1 }).catch(
      () => {}
    );
  } else {
    const taskRow = getTaskByUuid(task.taskId);
    const targetCount = taskRow?.targetCount ?? 0;
    const local = incrementTaskCompletionLocal(task.taskId, date, 1, targetCount);
    if (!local.completionUuid) return;
    patchTaskInCaches(queryClient, date, task.taskId, (t) => ({
      ...t,
      progress_count: local.progressCount,
      status: local.status,
    }));
    void incrementTaskMutationFn({
      completionUuid: local.completionUuid,
      taskUuid: task.taskId,
      amount: 1,
    }).catch(() => {});
  }

  // Streak chip's completed-dates window may gain "today".
  void queryClient.invalidateQueries({ queryKey: ['completedDates'] });
}

