/**
 * Soul Shield — ESP32-C3 physical counter button
 * ==============================================
 *
 * One physical button == +1 on the task the phone has selected for
 * Bluetooth control. The phone app scans for a device advertising
 * SERVICE_UUID, connects, and subscribes to CHAR_TX_UUID; every debounced
 * button press sends a one-byte notification ("1") to the app, which
 * increments the ACTIVE counter task/sub-task using the app's normal
 * increment pipeline (same as tapping +1 in the UI).
 *
 * Wiring:
 *   Button between GPIO4 and GND. Internal pull-up is enabled — no external
 *   resistor needed (CHANGE BUTTON_PIN below if you use another pin).
 *   STATUS_LED_PIN mirrors connection state (solid = connected) and blinks
 *   on every registered press. Set it to 255 to disable.
 *
 * Behavior:
 *   - Always advertising when disconnected → the app's auto-reconnect finds
 *     it again even after reboots.
 *   - One notification per press. 50 ms software debounce absorbs mechanical
 *     bounce without eating fast human tapping; presses while the phone is
 *     disconnected are ignored.
 *
 * Flash:  pio run -t upload   ·  Serial log:  pio device monitor
 * (BLE library ships with the espressif32 Arduino platform — no lib_deps.)
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------------------------------------------------------------------------
// CONFIG — the only things you may need to tweak
// ---------------------------------------------------------------------------

// The physical counter button: wired between this pin and GND
// (internal pull-up is enabled in setup()).
#define BUTTON_PIN 4

// Status LED (HIGH = on). Most C3 dev kits expose a simple LED on GPIO8;
// change if yours differs (or set to 255 to disable the LED entirely).
#define STATUS_LED_PIN 8

// How long the LED stays lit for a registered press (ms).
#define PRESS_LED_MS 120

// Debounce window: a press is registered on the FALLING edge only after the
// line has been stable for this long. 50 ms comfortably absorbs mechanical
// bounce without eating fast human tapping.
#define DEBOUNCE_MS 50

// --- BLE identity (MUST match lib/bluetooth/counter-ble.ts in the app) ---
#define SERVICE_UUID "9f83f3d0-8f5f-4a3f-9a1d-2c6a8f4e5b01"
// ESP32 -> phone (notify). One notification per button press.
#define CHAR_TX_UUID "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
// Phone -> ESP32 (write) — reserved for future commands; the app doesn't
// need to write anything for the counter feature to work.
#define CHAR_RX_UUID "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e"
#define DEVICE_NAME "SoulShield-ESP32"
// ---------------------------------------------------------------------------

BLEServer* server = nullptr;
BLECharacteristic* txCharacteristic = nullptr;
volatile bool deviceConnected = false;

unsigned long lastDebounceTime = 0;
int lastReading = HIGH;
int lastStableState = HIGH;

unsigned long pressLedOffAt = 0;
bool pressLedOn = false;

bool blinkActive() { return pressLedOn && millis() < pressLedOffAt; }

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    deviceConnected = true;
    Serial.println("Phone connected.");
  }
  void onDisconnect(BLEServer*) override {
    deviceConnected = false;
    Serial.println("Phone disconnected — advertising again.");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    // Reserved for future app->device commands; log for now.
    std::string value = characteristic->getValue();
    if (value.length() > 0) {
      Serial.print("RX: ");
      Serial.println(value.c_str());
    }
  }
};

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  if (STATUS_LED_PIN != 255) {
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
  }

  BLEDevice::init(DEVICE_NAME);
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService* service = server->createService(SERVICE_UUID);

  // TX: the phone subscribes here; one one-byte "1" notification per press.
  txCharacteristic = service->createCharacteristic(
      CHAR_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic* rxCharacteristic = service->createCharacteristic(
      CHAR_RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  rxCharacteristic->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  // Recommended connectable intervals — battery-friendly, and the phone's
  // scan (filtering on SERVICE_UUID) finds it within a couple of seconds.
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("SoulShield-ESP32 ready — advertising, waiting for the app.");
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastReading) {
    lastDebounceTime = millis();
    lastReading = reading;
  }

  if ((millis() - lastDebounceTime) > DEBOUNCE_MS && reading != lastStableState) {
    lastStableState = reading;
    // FALLING edge = pressed (pull-up wiring: pressed == LOW).
    if (lastStableState == LOW) {
      if (deviceConnected) {
        uint8_t increment = 1;
        txCharacteristic->setValue(&increment, 1);
        txCharacteristic->notify();
        Serial.println("Button press -> +1 notified");
      } else {
        Serial.println("Button press ignored (phone not connected)");
      }
      if (STATUS_LED_PIN != 255) {
        pressLedOn = true;
        pressLedOffAt = millis() + PRESS_LED_MS;
        digitalWrite(STATUS_LED_PIN, HIGH);
      }
    }
  }

  // Status LED: solid while connected; press-blink overrides briefly; off
  // when advertising for a phone.
  if (STATUS_LED_PIN != 255 && !blinkActive()) {
    digitalWrite(STATUS_LED_PIN, deviceConnected ? HIGH : LOW);
  }

  // Re-advertise whenever no phone is connected (auto-reconnect path).
  if (!deviceConnected) {
    BLEDevice::startAdvertising();
    delay(200);  // don't hammer the BLE stack
  } else {
    delay(10);
  }
}
