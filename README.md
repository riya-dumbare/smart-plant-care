# Smart Plant Care

An automatic plant watering system. A soil moisture sensor tells an Arduino UNO when the soil is dry, and the Arduino switches a water pump on through a relay. A web dashboard shows the live status over USB.

![Dashboard screenshot](docs/dashboard.png)
![Hardware setup](docs/setup.jpg)

## How it works

1. The Arduino reads the sensor's digital output every 0.4 s.
2. If the soil has read dry 3 times in a row, the pump is off, and 30 s have passed since it last stopped, the relay turns the pump on.
3. The pump stops when the soil reads wet, or after 10 s, whichever comes first.
4. The Arduino prints one line per cycle over serial, for example `DRY,ON` or `WET,OFF`.
5. The dashboard reads those lines in the browser using the Web Serial API and shows the soil state, the pump state, a log of pump runs, and a short history chart.

The 10 s run limit and 30 s cooldown stop the pump from overwatering if the sensor misreads or the water does not reach it.

## Components

- Arduino UNO
- Soil moisture sensor module (digital output)
- Relay module (active LOW)
- Water pump
- External power supply for the pump
- USB cable

## Wiring

| From | To |
|---|---|
| Soil sensor VCC / GND | Arduino 5V / GND |
| Soil sensor DO | Arduino pin 6 |
| Relay VCC / GND | Arduino 5V / GND |
| Relay IN | Arduino pin 3 |
| Pump | External power supply, switched through the relay |

## Run it

**1. Arduino**

1. Open `firmware/smart_plant_uno/smart_plant_uno.ino` in the Arduino IDE.
2. Select the board (Arduino Uno) and the port, then click Upload.
3. Close the Serial Monitor if it is open, because it blocks the browser from using the port.

The sketch stays on the board, so you only need to upload again when you change it.

**2. Dashboard**

```bash
cd dashboard
npm install
npm run dev
```

Open the address it prints (usually `http://localhost:5173`) in **Chrome or Edge**, click **Connect**, and choose the Arduino's port.

## Project structure

```
firmware/smart_plant_uno/   Arduino sketch
dashboard/                  Web dashboard (TanStack Start, React, TypeScript, Tailwind)
```

## Limitations

- The sensor's digital output only reports dry or wet. The switching point is set with the potentiometer on the sensor module.
- Web Serial works only in Chrome and Edge.
- The dashboard needs the board connected by USB.

## Future work

- Read the sensor's analog output to show a moisture percentage.
- Use an ESP32 with WiFi so the dashboard works without a USB cable.
- Keep reading history after a page refresh.