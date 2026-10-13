# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## MQTT setup

The dashboard talks to your broker over WebSocket TLS. Copy `.env.example` to `.env`,
fill in the three values, then run `npm run dev`.

| Variable | Example |
| --- | --- |
| `VITE_MQTT_URL` | `wss://your-broker-host:8884/mqtt` |
| `VITE_MQTT_USERNAME` | `dashboard` |
| `VITE_MQTT_PASSWORD` | `change-me` |

Without these the page shows a setup notice instead of connecting.

- Subscribes to `plant/data` — JSON `{moisture, pump, auto, threshold, rssi}`.
- Publishes to `plant/cmd` — `{"auto":bool}`, `{"pump":bool}`, `{"threshold":n}`.
- The pump button only works in Manual mode; the threshold slider sends its value on release.
- An "ESP32 offline" banner appears when no message arrives for 15 seconds.

These settings are bundled into the browser, so use a broker account that is only
allowed to read `plant/data` and publish to `plant/cmd`.
