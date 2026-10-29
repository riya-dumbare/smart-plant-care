const int RELAY_PIN  = 3;
const int SENSOR_PIN = 6;

const unsigned long MAX_PUMP_MS = 10000;   
const unsigned long COOLDOWN_MS = 30000;  
const int DRY_READINGS_NEEDED = 3;         

bool pumpOn = false;
int dryCount = 0;
unsigned long pumpStartedAt = 0;
unsigned long pumpStoppedAt = 0;

void setup() {
  Serial.begin(9600);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(SENSOR_PIN, INPUT);
  digitalWrite(RELAY_PIN, HIGH);  
}

void loop() {
  bool rawDry = digitalRead(SENSOR_PIN) == HIGH;   
  dryCount = rawDry ? min(dryCount + 1, DRY_READINGS_NEEDED) : 0;
  bool dry = dryCount >= DRY_READINGS_NEEDED;

  if (dry && !pumpOn && millis() - pumpStoppedAt > COOLDOWN_MS) {
    pumpOn = true;
    pumpStartedAt = millis();
    digitalWrite(RELAY_PIN, LOW);    
  }
  if (pumpOn && (!dry || millis() - pumpStartedAt > MAX_PUMP_MS)) {
    pumpOn = false;
    pumpStoppedAt = millis();
    digitalWrite(RELAY_PIN, HIGH);   
  }

  Serial.print(dry ? "DRY" : "WET");
  Serial.print(",");
  Serial.println(pumpOn ? "ON" : "OFF");
  delay(400);
}