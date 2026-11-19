/**
 * Soul Shield — ESP32 Dev Module physical counter button
 * ======================================================
 *
 * One physical button == +1 on the task the phone has selected for
 * Bluetooth control. The phone app scans for a device advertising
 * SERVICE_UUID, connects, and subscribes to CHAR_TX_UUID; every debounced
 * button press sends a one-byte notification ("1") to the app, which
 * increments the ACTIVE counter task/sub-task using the app's normal
 * increment pipeline (same as tapping +1 in the UI).
 *
 * The app ANSWERS every press with one byte on CHAR_RX_UUID (counted /
 * target reached / already complete / no task / failed), and also tells the
 * device whether the active task is still counting or complete. Once the
 * target is reached the app stops counting presses; this firmware shows all
 * of it on the built-in LED + a buzzer (see the FEEDBACK table below).
 *
 * Wiring:
 *   Button : GPIO4 <-> GND (internal pull-up, no resistor needed).
 *   LED    : built-in LED on GPIO2.
 *   Buzzer : + leg -> GPIO23, - leg -> GND. Passive buzzer (needs a tone)
 *            by default — set BUZZER_PASSIVE to 0 for an active buzzer
 *            (beeps on its own when powered). BUZZER_PIN 255 = no buzzer.
 *
 * FEEDBACK — idle LED (repeats while nothing else is playing):
 *   Searching for phone ........ one short flash every 2 s
 *   Connected, task counting ... solid ON
 *   Connected, task COMPLETE ... double blink (heartbeat) every 1.6 s
 *   Connected, no task chosen .. slow even blink (1 s on / 1 s off)
 *
 * FEEDBACK — events (LED + buzzer, one-shot):
 *   Phone connected ............ 2 quick blinks, rising beep-beep
 *   Phone disconnected ......... 1 long blink, falling beep-beep
 *   Press counted (app ack) .... LED flicks off once + short high tick
 *   TARGET REACHED ............. victory melody + ~2 s of rapid blinking
 *   Press after completion ..... 2 low buzzes + 2 blinks (NOT counted)
 *   No task selected in app .... 2 medium beeps + 2 slow blinks
 *   Update NOT received ........ 3 fast blinks + 3 low beeps
 *     (no answer from the app within ACK_TIMEOUT_MS, app not subscribed,
 *      or the app couldn't save the press)
 *   Press while disconnected ... 1 long blink + 1 long low tone
 *
 * Flash:  pio run -t upload   ·  Serial log:  pio device monitor
 * (BLE library ships with the espressif32 Arduino platform — no lib_deps.)
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

//  * VARIANT: generic ESP32 Dev Module (classic ESP32/WROOM-32) — separate
//  * PlatformIO project from the ESP32-C3 one (Framework/). BLE identity is
//  * IDENTICAL, so the Soul Shield app pairs with either board the same way.
//  *
// ---------------------------------------------------------------------------
// CONFIG — the only things you may need to tweak
// ---------------------------------------------------------------------------

// The physical counter button: wired between this pin and GND
// (internal pull-up is enabled in setup()).
#define BUTTON_PIN 4

// Built-in LED (HIGH = on). Classic ESP32 Dev Module boards use GPIO2.
// 255 disables the LED.
#define STATUS_LED_PIN 2

// Buzzer signal pin (255 disables the buzzer).
#define BUZZER_PIN 23
// 1 = passive buzzer (driven with a PWM tone, can play different pitches).
// 0 = active buzzer (has its own oscillator: just switched on/off, so every
//     tone below sounds the same pitch — the rhythm still tells them apart).
#define BUZZER_PASSIVE 1
#define BUZZER_LEDC_CHANNEL 0

// How long to wait for the app's answer to a press before signalling
// "update not received" (ms).
#define ACK_TIMEOUT_MS 1500

// Debounce window: a press is registered on the FALLING edge only after the
// line has been stable for this long. 50 ms comfortably absorbs mechanical
// bounce without eating fast human tapping.
#define DEBOUNCE_MS 50

// --- BLE identity (MUST match lib/bluetooth/counter-ble.ts in the app) ---
#define SERVICE_UUID "9f83f3d0-8f5f-4a3f-9a1d-2c6a8f4e5b01"
// ESP32 -> phone (notify). One notification per button press.
#define CHAR_TX_UUID "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"
// Phone -> ESP32 (write). One-byte messages, see handleMessage().
#define CHAR_RX_UUID "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e"
#define DEVICE_NAME "SoulShield-ESP32"
// ---------------------------------------------------------------------------

// ===========================================================================
// LED + buzzer pattern player (non-blocking)
// ===========================================================================

struct Step {
  uint8_t led;      // 1 = LED on, 0 = off
  uint16_t toneHz;  // 0 = silent
  uint16_t ms;      // duration of this step
};

#define PATTERN(name, ...) \
  const Step name[] = {__VA_ARGS__}; \
  const uint8_t name##_LEN = sizeof(name) / sizeof(Step)

// Musical notes (Hz) for the passive buzzer.
#define N_C5 523
#define N_E5 659
#define N_G5 784
#define N_C6 1047

PATTERN(PAT_CONNECTED,      {1, 1200, 90}, {0, 0, 70}, {1, 1800, 90}, {0, 0, 150});
PATTERN(PAT_DISCONNECTED,   {1, 1500, 120}, {1, 0, 60}, {1, 900, 220}, {0, 0, 200});
PATTERN(PAT_COUNTED,        {0, 2400, 45}, {0, 0, 55});
PATTERN(PAT_TARGET_REACHED,
        {1, N_C5, 130}, {0, 0, 30}, {1, N_E5, 130}, {0, 0, 30},
        {1, N_G5, 130}, {0, 0, 30}, {1, N_C6, 380}, {0, 0, 100},
        {1, 0, 80}, {0, 0, 80}, {1, 0, 80}, {0, 0, 80}, {1, 0, 80}, {0, 0, 80},
        {1, 0, 80}, {0, 0, 80}, {1, 0, 80}, {0, 0, 80}, {1, 0, 80}, {0, 0, 80},
        {1, 0, 80}, {0, 0, 80}, {1, 0, 80}, {0, 0, 80}, {1, 0, 80}, {0, 0, 300});
PATTERN(PAT_ALREADY_COMPLETE, {0, 0, 60}, {1, 330, 160}, {0, 0, 90}, {1, 330, 160}, {0, 0, 200});
PATTERN(PAT_NO_TASK,        {0, 0, 80}, {1, 880, 250}, {0, 0, 250}, {1, 880, 250}, {0, 0, 250});
PATTERN(PAT_NOT_RECEIVED,
        {1, 220, 70}, {0, 0, 70}, {1, 220, 70}, {0, 0, 70}, {1, 220, 70}, {0, 0, 250});
PATTERN(PAT_OFFLINE_PRESS,  {1, 200, 450}, {0, 0, 200});

const Step* seq = nullptr;
uint8_t seqLen = 0;
uint8_t seqIdx = 0;
unsigned long stepStartedAt = 0;

void setLed(bool on) {
  if (STATUS_LED_PIN != 255) digitalWrite(STATUS_LED_PIN, on ? HIGH : LOW);
}

void setTone(uint16_t hz) {
  if (BUZZER_PIN == 255) return;
#if BUZZER_PASSIVE
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(BUZZER_PIN, hz);
#else
  ledcWriteTone(BUZZER_LEDC_CHANNEL, hz);
#endif
#else
  digitalWrite(BUZZER_PIN, hz > 0 ? HIGH : LOW);
#endif
}

void startStep() {
  setLed(seq[seqIdx].led);
  setTone(seq[seqIdx].toneHz);
  stepStartedAt = millis();
}

/** Plays a one-shot pattern, interrupting whatever was playing. */
void play(const Step* pattern, uint8_t len) {
  seq = pattern;
  seqLen = len;
  seqIdx = 0;
  startStep();
}
#define PLAY(name) play(name, name##_LEN)

/** Advances the current pattern; returns true while one is playing. */
bool updatePattern() {
  if (!seq) return false;
  if (millis() - stepStartedAt < seq[seqIdx].ms) return true;
  if (++seqIdx >= seqLen) {
    seq = nullptr;
    setTone(0);
    return false;
  }
  startStep();
  return true;
}

// ===========================================================================
// State
// ===========================================================================

enum TaskState { TASK_UNKNOWN, TASK_OPEN, TASK_DONE, TASK_NONE };

BLEServer* server = nullptr;
BLECharacteristic* txCharacteristic = nullptr;
BLE2902* txCccd = nullptr;  // tells us whether the app subscribed to presses
volatile bool deviceConnected = false;
bool wasConnected = false;
TaskState taskState = TASK_UNKNOWN;

unsigned long lastDebounceTime = 0;
int lastReading = HIGH;
int lastStableState = HIGH;

// Presses sent and still waiting for the app's answer.
uint8_t awaitingReplies = 0;
unsigned long replyDeadline = 0;

unsigned long nextAdvertiseAt = 0;

// Messages from the app arrive on the BLE task; hand them to loop() through a
// small single-producer / single-consumer ring buffer.
#define RX_BUF_SIZE 16
volatile uint8_t rxHead = 0;
volatile uint8_t rxTail = 0;
char rxBuf[RX_BUF_SIZE];

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { deviceConnected = true; }
  void onDisconnect(BLEServer*) override { deviceConnected = false; }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    std::string value = characteristic->getValue();
    for (char c : value) {
      uint8_t next = (rxHead + 1) % RX_BUF_SIZE;
      if (next == rxTail) break;  // full — drop (never happens at human speed)
      rxBuf[rxHead] = c;
      rxHead = next;
    }
  }
};

// ===========================================================================
// App messages (MUST match ESP_REPLY / ESP_STATE in the app's counter-ble.ts)
// ===========================================================================

void replyArrived() {
  if (awaitingReplies > 0) awaitingReplies--;
}

void handleMessage(char c) {
  switch (c) {
    // --- replies to a press ---
    case 'A':  // counted
      replyArrived();
      taskState = TASK_OPEN;
      PLAY(PAT_COUNTED);
      Serial.println("App: +1 counted");
      break;
    case 'D':  // this press reached the target
      replyArrived();
      taskState = TASK_DONE;
      PLAY(PAT_TARGET_REACHED);
      Serial.println("App: TARGET REACHED — task complete, further presses won't count");
      break;
    case 'X':  // already complete, press ignored
      replyArrived();
      taskState = TASK_DONE;
      PLAY(PAT_ALREADY_COMPLETE);
      Serial.println("App: task already complete — press not counted");
      break;
    case 'N':  // no task selected
      replyArrived();
      taskState = TASK_NONE;
      PLAY(PAT_NO_TASK);
      Serial.println("App: no task selected for Bluetooth control");
      break;
    case 'E':  // the app couldn't save it
      replyArrived();
      PLAY(PAT_NOT_RECEIVED);
      Serial.println("App: press could not be saved");
      break;
    // --- state sync (no sound, just the idle LED) ---
    case 'U':
      taskState = TASK_OPEN;
      Serial.println("App: active task is counting");
      break;
    case 'C':
      taskState = TASK_DONE;
      Serial.println("App: active task is complete");
      break;
    case '0':
      taskState = TASK_NONE;
      Serial.println("App: no active task");
      break;
    default:
      Serial.print("App: unknown message ");
      Serial.println((int)c);
  }
}

// ===========================================================================
// Idle LED (what the LED shows when no event pattern is playing)
// ===========================================================================

bool idleLed(unsigned long now) {
  if (!deviceConnected) return (now % 2000) < 80;  // searching
  switch (taskState) {
    case TASK_DONE: {
      unsigned long t = now % 1600;  // heartbeat double blink
      return t < 100 || (t >= 250 && t < 350);
    }
    case TASK_NONE:
      return (now % 2000) < 1000;
    case TASK_OPEN:
    case TASK_UNKNOWN:
    default:
      return true;  // solid
  }
}

// ===========================================================================

void onButtonPressed() {
  if (!deviceConnected) {
    PLAY(PAT_OFFLINE_PRESS);
    Serial.println("Button press ignored (phone not connected)");
    return;
  }
  if (txCccd && !txCccd->getNotifications()) {
    // Connected but the app isn't listening — the press would go nowhere.
    PLAY(PAT_NOT_RECEIVED);
    Serial.println("Button press NOT sent (app not subscribed yet)");
    return;
  }
  uint8_t increment = 1;
  txCharacteristic->setValue(&increment, 1);
  txCharacteristic->notify();
  awaitingReplies++;
  replyDeadline = millis() + ACK_TIMEOUT_MS;
  Serial.println("Button press -> sent, waiting for the app");
}

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  if (STATUS_LED_PIN != 255) {
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(STATUS_LED_PIN, LOW);
  }
  if (BUZZER_PIN != 255) {
#if BUZZER_PASSIVE
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(BUZZER_PIN, 2000, 8);
#else
    ledcSetup(BUZZER_LEDC_CHANNEL, 2000, 8);
    ledcAttachPin(BUZZER_PIN, BUZZER_LEDC_CHANNEL);
#endif
#else
    pinMode(BUZZER_PIN, OUTPUT);
#endif
    setTone(0);
  }

  BLEDevice::init(DEVICE_NAME);
  server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService* service = server->createService(SERVICE_UUID);

  // TX: the phone subscribes here; one one-byte "1" notification per press.
  txCharacteristic = service->createCharacteristic(
      CHAR_TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txCccd = new BLE2902();
  txCharacteristic->addDescriptor(txCccd);

  // RX: the app's answers + task state.
  BLECharacteristic* rxCharacteristic = service->createCharacteristic(
      CHAR_RX_UUID, BLECharacteristic::PROPERTY_WRITE);
  rxCharacteristic->setCallbacks(new RxCallbacks());

  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("SoulShield-ESP32 ready — advertising, waiting for the app.");
}

void loop() {
  unsigned long now = millis();

  // --- connection changes ---
  bool connected = deviceConnected;
  if (connected != wasConnected) {
    wasConnected = connected;
    awaitingReplies = 0;
    if (connected) {
      taskState = TASK_UNKNOWN;  // the app sends the real state right away
      PLAY(PAT_CONNECTED);
      Serial.println("Phone connected.");
    } else {
      PLAY(PAT_DISCONNECTED);
      Serial.println("Phone disconnected — advertising again.");
      nextAdvertiseAt = now + 500;  // let the stack settle first
    }
  }

  // --- messages from the app ---
  while (rxTail != rxHead) {
    char c = rxBuf[rxTail];
    rxTail = (rxTail + 1) % RX_BUF_SIZE;
    handleMessage(c);
  }

  // --- button (debounced, FALLING edge = pressed) ---
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastReading) {
    lastDebounceTime = now;
    lastReading = reading;
  }
  if ((now - lastDebounceTime) > DEBOUNCE_MS && reading != lastStableState) {
    lastStableState = reading;
    if (lastStableState == LOW) onButtonPressed();
  }

  // --- the app never answered ---
  if (awaitingReplies > 0 && (long)(now - replyDeadline) >= 0) {
    awaitingReplies = 0;
    PLAY(PAT_NOT_RECEIVED);
    Serial.println("No answer from the app — update NOT received");
  }

  // --- LED / buzzer ---
  if (!updatePattern()) setLed(idleLed(now));

  // --- keep advertising while no phone is connected (auto-reconnect) ---
  if (!connected && (long)(now - nextAdvertiseAt) >= 0) {
    BLEDevice::startAdvertising();
    nextAdvertiseAt = now + 2000;
  }

  delay(5);
}
