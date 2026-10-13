// Smart Plant Care - ESP32 firmware
// Libraries (Arduino Library Manager): PubSubClient, ArduinoJson
// Board: "ESP32 Dev Module"

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

const char* TOPIC_DATA  = "plant/data";   // ESP32 -> dashboard
const char* TOPIC_CMD   = "plant/cmd";    // dashboard -> ESP32

// ---------- Pins ----------
const int SOIL_PIN  = 34;
const int RELAY_PIN = 26;
const bool RELAY_ACTIVE_LOW = true;       // most relay modules are active LOW

// ---------- Sensor calibration ----------
// Measure analogRead() with the probe in air (dry) and in water (wet), then edit.
const int RAW_DRY = 3200;
const int RAW_WET = 1400;

// ---------- Irrigation settings ----------
int  thresholdPct       = 35;     // start watering below this moisture %
const int HYSTERESIS    = 10;     // stop watering at threshold + this
const unsigned long MAX_PUMP_MS   = 30000;   // safety: max continuous run
const unsigned long COOLDOWN_MS   = 60000;   // wait after a run before next auto run
const unsigned long PUBLISH_MS    = 5000;

bool autoMode = true;
bool pumpOn   = false;
unsigned long pumpStartedAt = 0;
unsigned long pumpStoppedAt = 0;
unsigned long lastPublish   = 0;

WiFiClientSecure net;
PubSubClient mqtt(net);

void setPump(bool on) {
  if (on == pumpOn) return;
  pumpOn = on;
  digitalWrite(RELAY_PIN, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
  if (on) pumpStartedAt = millis(); else pumpStoppedAt = millis();
}

int readMoisturePct() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(SOIL_PIN); delay(5); }
  int raw = sum / 10;
  int pct = map(raw, RAW_DRY, RAW_WET, 0, 100);
  return constrain(pct, 0, 100);
}

void publishState(int moisture) {
  StaticJsonDocument<192> doc;
  doc["moisture"]  = moisture;
  doc["pump"]      = pumpOn;
  doc["auto"]      = autoMode;
  doc["threshold"] = thresholdPct;
  doc["rssi"]      = WiFi.RSSI();
  char buf[192];
  size_t n = serializeJson(doc, buf);
  mqtt.publish(TOPIC_DATA, (const uint8_t*)buf, n, true);  // retained
}

// Commands: {"auto":true} {"pump":true} {"threshold":40}
void onMessage(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, payload, len)) return;

  if (doc.containsKey("auto")) autoMode = doc["auto"];
  if (doc.containsKey("threshold")) thresholdPct = constrain((int)doc["threshold"], 5, 90);
  if (doc.containsKey("pump") && !autoMode) setPump(doc["pump"]);
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String id = "esp32-plant-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(id.c_str(), MQTT_USER, MQTT_PASS)) {
      mqtt.subscribe(TOPIC_CMD);
    } else {
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);  // pump off
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);

  connectWifi();
  net.setInsecure();  // OK for a prototype; use net.setCACert() for production
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  int moisture = readMoisturePct();

  // Auto irrigation
  if (autoMode) {
    if (!pumpOn && moisture < thresholdPct &&
        millis() - pumpStoppedAt > COOLDOWN_MS) {
      setPump(true);
    } else if (pumpOn && moisture >= thresholdPct + HYSTERESIS) {
      setPump(false);
    }
  } else if (!pumpOn) {
    // nothing; manual mode waits for commands
  }

  // Safety cutoff in every mode
  if (pumpOn && millis() - pumpStartedAt > MAX_PUMP_MS) setPump(false);

  if (millis() - lastPublish >= PUBLISH_MS) {
    lastPublish = millis();
    publishState(moisture);
    Serial.printf("moisture=%d%% pump=%d auto=%d\n", moisture, pumpOn, autoMode);
  }
}
