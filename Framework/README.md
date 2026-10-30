# Soul Shield ESP32 — physical counter button firmware

PlatformIO project for the **ESP32-C3**: one physical button sends a BLE
notification to the Soul Shield app, which increments the counter task /
sub-task currently selected for Bluetooth control — same pipeline as a +1 tap
in the app (local-first write, offline queue, backend sync).

## Requirements

- ESP32-C3 dev kit (BLE-only chip — Bluetooth Classic is not supported by the
  C3, and not needed).
- VS Code + PlatformIO extension (or PlatformIO CLI).
- A push button (see wiring below).

## Wiring

| Button leg | Connects to |
|---|---|
| Leg 1 | **GPIO4** |
| Leg 2 | **GND** |

Internal pull-up is enabled in firmware — no external resistor needed.
Button pin is the `BUTTON_PIN` constant at the top of `src/main.cpp` if you
use different wiring.

## Flash

```bash
cd Framework
pio run -t upload          # build + flash
pio device monitor         # open the serial log (115200)
```

First flash to a **brand-new C3** may need `pio run -t erase` first (first-flash
flashing quirk on some boards).

## BLE profile (matches `lib/bluetooth/counter-ble.ts` in the app)

| Item | Value |
|---|---|
| Device name | `SoulShield-ESP32` |
| Service UUID | `9f83f3d0-8f5f-4a3f-9a1d-2c6a8f4e5b01` |
| TX (ESP32 → phone, notify) | `a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d` |
| RX (phone → ESP32, write) | `b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e` |

Every debounced button press notifies **one byte `0x31` ("1")** on the TX
characteristic. The app increments the ACTIVE counter task/sub-task by 1.
The RX characteristic is reserved for future app→device commands.

## LED

- **Solid** — a phone is connected.
- **Short blink** — a press was registered and notified.
- **Off** — advertising, waiting for a connection.

## Behavior notes

- The device is always advertising when disconnected, so the app's
  auto-reconnect (one-time picker + auto-reconnect in the app) finds it after
  reboots or out-of-range periods.
- Presses while no phone is connected are ignored (logged only).
- 50 ms software debounce; each press = exactly one increment.
