// Smart Plant Care - Arduino UNO
// Relay IN  -> pin 3
// Soil sensor DO -> pin 6
// Prints one line every 0.4 s, e.g. "DRY,ON" or "WET,OFF" (the dashboard reads this)

const int RELAY_PIN  = 3;
const int SENSOR_PIN = 6;

const unsigned long MAX_PUMP_MS = 10000;   // pump runs max 10 s at a time
const unsigned long COOLDOWN_MS = 30000;   // wait 30 s before running again

bool pumpOn = false;
unsigned long pumpStartedAt = 0;
unsigned long pumpStoppedAt = 0;

void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(SENSOR_PIN, INPUT);
  digitalWrite(RELAY_PIN, HIGH);   // relay off at start (active LOW module)
}

void loop() {
  bool dry = digitalRead(SENSOR_PIN) == HIGH;   // HIGH = dry soil

  if (dry && !pumpOn && millis() - pumpStoppedAt > COOLDOWN_MS) {
    pumpOn = true;
    pumpStartedAt = millis();
    digitalWrite(RELAY_PIN, LOW);    // pump ON
  }
  if (pumpOn && (!dry || millis() - pumpStartedAt > MAX_PUMP_MS)) {
    pumpOn = false;
    pumpStoppedAt = millis();
    digitalWrite(RELAY_PIN, HIGH);   // pump OFF
  }

  Serial.print(dry ? "DRY" : "WET");
  Serial.print(",");
  Serial.println(pumpOn ? "ON" : "OFF");
  delay(400);
}
