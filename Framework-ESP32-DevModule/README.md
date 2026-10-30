# Soul Shield — ESP32 Dev Module (classic ESP32) counter button firmware

The classic **ESP32 / ESP32 Dev Module** variant of the counter-button
firmware — separate from the ESP32-C3 project (`Framework/`) so each board
has its own PlatformIO environment. BLE identity and behavior are
**identical** to the C3 build, so the Soul Shield app pairs with either
board exactly the same way.

## Requirements

- Generic ESP32 / ESP32-WROOM-32 DevKit ("ESP32 Dev Module" in PlatformIO).
- VS Code + PlatformIO extension (or PlatformIO CLI).
- A push button (wiring below).

## Wiring

| Button leg | Connects to |
|---|---|
| Leg 1 | **GPIO4** |
| Leg 2 | **GND** |

Internal pull-up is enabled in firmware — no external resistor needed.
Pin is the `BUTTON_PIN` constant at the top of `src/main.cpp`.

Status LED: **GPIO2** (the classic DevKit's onboard LED). Set
`STATUS_LED_PIN` to 255 to disable.

## Flash

```bash
cd Framework-ESP32-DevModule
pio run -t upload          # build + flash (hold BOOT if upload fails)
pio device monitor         # serial log (115200)
```

## BLE profile

Identical to the C3 firmware (and to `lib/bluetooth/counter-ble.ts`):

| Item | Value |
|---|---|
| Device name | `SoulShield-ESP32` |
| Service UUID | `9f83f3d0-8f5f-4a3f-9a1d-2c6a8f4e5b01` |
| TX (ESP32 → phone, notify) | `a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d` |
| RX (phone → ESP32, write) | `b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e` |

One debounced press = one one-byte `"1"` notification = +1 on the app's
active Bluetooth-controlled counter task/sub-task.

## LED

- **Solid** — phone connected.
- **Short blink** — press registered and notified.
- **Off** — advertising, waiting for a connection.

## Notes

- Classic ESP32 also supports Bluetooth Classic (SPP), but BLE is used here
  so both board variants share the exact same firmware logic and app side.
- The device always advertises when disconnected → the app's one-time picker
  + auto-reconnect works after reboots or out-of-range periods.
