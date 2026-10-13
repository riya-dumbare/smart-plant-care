import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { MqttClient } from "mqtt";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plant Irrigation Dashboard" },
      { name: "description", content: "Live moisture, pump and WiFi status for your ESP32 smart plant irrigation system." },
      { property: "og:title", content: "Plant Irrigation Dashboard" },
      { property: "og:description", content: "Live moisture, pump control and threshold settings over MQTT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" },
    ],
  }),
  component: Dashboard,
});

type PlantData = { moisture: number; pump: boolean; auto: boolean; threshold: number; rssi: number };

const URL_ = import.meta.env["VITE_MQTT_URL"] as string | undefined;
const USER = import.meta.env["VITE_MQTT_USERNAME"] as string | undefined;
const PASS = import.meta.env["VITE_MQTT_PASSWORD"] as string | undefined;
const OFFLINE_MS = 15000;

function Dashboard() {
  const clientRef = useRef<MqttClient | null>(null);
  const [conn, setConn] = useState<"connecting" | "connected" | "error" | "missing">(URL_ ? "connecting" : "missing");
  const [data, setData] = useState<PlantData | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [lastMsg, setLastMsg] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [threshold, setThreshold] = useState(40);
  const dragging = useRef(false);
  const connectedAt = useRef(0);

  useEffect(() => {
    if (!URL_) return;
    let client: MqttClient | null = null;
    import("mqtt").then(({ default: mqtt }) => {
      client = mqtt.connect(URL_, { ...(USER ? { username: USER } : {}), ...(PASS ? { password: PASS } : {}), reconnectPeriod: 3000, clientId: "dash_" + Math.random().toString(16).slice(2, 10) });
      clientRef.current = client;
      client.on("connect", () => { setConn("connected"); connectedAt.current = Date.now(); client!.subscribe("plant/data"); });
      client.on("error", () => setConn("error"));
      client.on("reconnect", () => setConn("connecting"));
      client.on("message", (topic, payload) => {
        if (topic !== "plant/data") return;
        try {
          const d = JSON.parse(payload.toString()) as PlantData;
          setData(d);
          setLastMsg(Date.now());
          setHistory((h) => [...h, Number(d.moisture)].slice(-50));
          if (!dragging.current) setThreshold(Number(d.threshold));
        } catch { /* ignore malformed */ }
      });
    });
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); client?.end(true); };
  }, []);

  const publish = (msg: object) => clientRef.current?.publish("plant/cmd", JSON.stringify(msg));
  const offline = conn === "connected" && now - (lastMsg || connectedAt.current) > OFFLINE_MS;
  const neverHeard = conn === "connected" && lastMsg === 0;
  const isAuto = data?.auto ?? true;

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      {(offline) && (
        <div className="bg-warn px-4 py-3 text-center font-bold text-background">ESP32 offline — no data for over 15 seconds</div>
      )}
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">🌱 Plant Irrigation</h1>
          <span className="rounded-full border border-line px-3 py-1 text-sm text-dim">
            Broker: <b className={conn === "connected" ? "text-leaf" : "text-warn"}>{conn}</b>
          </span>
        </header>

        {conn === "missing" && (
          <div className="mb-6 rounded-2xl border border-warn p-4 text-sm">
            Set <code>VITE_MQTT_URL</code> (e.g. wss://host:8884/mqtt), <code>VITE_MQTT_USERNAME</code> and <code>VITE_MQTT_PASSWORD</code> to connect.
          </div>
        )}
        {neverHeard && <p className="mb-4 text-sm text-dim">Connected — waiting for first message from the ESP32…</p>}

        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Soil moisture"><Gauge value={data?.moisture} threshold={threshold} /></Card>
          <Card title="Pump">
            <div className="flex h-full flex-col items-center justify-center gap-3 py-6">
              <div className={`h-20 w-20 rounded-full ${data?.pump ? "bg-water animate-pulse" : "bg-line"}`} />
              <p className="text-2xl font-bold">{data ? (data.pump ? "Running" : "Off") : "—"}</p>
              <p className="text-sm text-dim">Mode: {data ? (data.auto ? "Auto" : "Manual") : "—"}</p>
            </div>
          </Card>
          <Card title="WiFi signal"><Signal rssi={data?.rssi} /></Card>
        </div>

        <Card title="Last 50 readings" className="mt-4"><Chart values={history} threshold={threshold} /></Card>

        <Card title="Controls" className="mt-4">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm text-dim">Mode</p>
              <div className="inline-flex rounded-full border border-line p-1">
                {[true, false].map((a) => (
                  <button key={String(a)} disabled={conn !== "connected"} onClick={() => publish({ auto: a })}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition ${isAuto === a ? "bg-leaf text-background" : "text-dim"} disabled:opacity-50`}>
                    {a ? "Auto" : "Manual"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm text-dim">Pump {isAuto && "(switch to Manual)"}</p>
              <button disabled={isAuto || conn !== "connected"} onClick={() => publish({ pump: !data?.pump })}
                className="rounded-full bg-water px-6 py-2 font-bold text-background transition disabled:cursor-not-allowed disabled:opacity-40">
                {data?.pump ? "Turn pump off" : "Turn pump on"}
              </button>
            </div>
            <div>
              <p className="mb-2 text-sm text-dim">Threshold: <b className="text-foreground">{threshold}%</b></p>
              <input type="range" min={5} max={90} value={threshold} disabled={conn !== "connected"}
                onPointerDown={() => (dragging.current = true)}
                onChange={(e) => setThreshold(Number(e.target.value))}
                onPointerUp={(e) => { dragging.current = false; publish({ threshold: Number((e.target as HTMLInputElement).value) }); }}
                onKeyUp={(e) => publish({ threshold: Number((e.target as HTMLInputElement).value) })}
                className="w-full accent-leaf" />
              <div className="flex justify-between text-xs text-dim"><span>5</span><span>90</span></div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="mb-2 text-sm uppercase tracking-widest text-dim">{title}</h2>
      {children}
    </section>
  );
}

function Gauge({ value, threshold }: { value?: number | undefined; threshold: number }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const arc = (p: number) => {
    const a = Math.PI * (1 - p / 100);
    return [100 + 80 * Math.cos(a), 100 - 80 * Math.sin(a)];
  };
  const [x, y] = arc(v);
  const [tx, ty] = arc(threshold);
  return (
    <svg viewBox="0 0 200 120" className="w-full">
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--line)" strokeWidth="16" strokeLinecap="round" />
      {value !== undefined && v > 0 && (
        <path d={`M20 100 A80 80 0 0 1 ${x} ${y}`} fill="none" stroke={v < threshold ? "var(--warn)" : "var(--leaf)"} strokeWidth="16" strokeLinecap="round" />
      )}
      <circle cx={tx} cy={ty} r="4" fill="var(--water)" />
      <text x="100" y="95" textAnchor="middle" fill="var(--foreground)" fontSize="30" fontWeight="700">{value !== undefined ? `${Math.round(v)}%` : "—"}</text>
    </svg>
  );
}

function Signal({ rssi }: { rssi?: number | undefined }) {
  const bars = rssi === undefined ? 0 : rssi > -55 ? 4 : rssi > -67 ? 3 : rssi > -78 ? 2 : 1;
  const label = ["No data", "Weak", "Fair", "Good", "Excellent"][bars];
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div className="flex h-20 items-end gap-2">
        {[1, 2, 3, 4].map((b) => (
          <div key={b} className={`w-4 rounded ${b <= bars ? "bg-leaf" : "bg-line"}`} style={{ height: `${b * 25}%` }} />
        ))}
      </div>
      <p className="text-2xl font-bold">{rssi !== undefined ? `${rssi} dBm` : "—"}</p>
      <p className="text-sm text-dim">{label}</p>
    </div>
  );
}

function Chart({ values, threshold }: { values: number[]; threshold: number }) {
  const W = 600, H = 180;
  if (values.length < 2) return <p className="py-12 text-center text-dim">Waiting for readings…</p>;
  const pts = values.map((v, i) => `${(i / 49) * W},${H - (v / 100) * H}`).join(" ");
  const ty = H - (threshold / 100) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" preserveAspectRatio="none">
      {[25, 50, 75].map((g) => <line key={g} x1="0" x2={W} y1={H - (g / 100) * H} y2={H - (g / 100) * H} stroke="var(--line)" />)}
      <line x1="0" x2={W} y1={ty} y2={ty} stroke="var(--water)" strokeDasharray="6 6" />
      <polyline points={pts} fill="none" stroke="var(--leaf)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
