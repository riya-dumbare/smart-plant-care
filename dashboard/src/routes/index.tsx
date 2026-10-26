import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Plant Irrigation Dashboard" },
      { name: "description", content: "Live soil and pump status from your Arduino UNO over USB." },
      { property: "og:title", content: "Plant Irrigation Dashboard" },
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

// Minimal Web Serial types (not in TypeScript's default DOM lib)
interface SerialPortLike {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
}
interface SerialLike {
  requestPort(): Promise<SerialPortLike>;
}

type Reading = { dry: boolean; pump: boolean; at: number };
type Conn = "idle" | "connecting" | "connected" | "error" | "unsupported";

const MAX_READINGS = 60;

function Dashboard() {
  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const keepReading = useRef(false);
  const lastPump = useRef(false);

  const [conn, setConn] = useState<Conn>("idle");
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [runs, setRuns] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const onLine = useCallback((line: string) => {
    const m = line.trim().match(/^(DRY|WET),(ON|OFF)$/);
    if (!m) return;
    const r: Reading = { dry: m[1] === "DRY", pump: m[2] === "ON", at: Date.now() };
    setCurrent(r);
    setHistory((h) => [...h, r].slice(-MAX_READINGS));
    if (r.pump && !lastPump.current) {
      setRuns((n) => n + 1);
      setLog((l) => [`Pump started at ${new Date(r.at).toLocaleTimeString()}`, ...l].slice(0, 20));
    }
    lastPump.current = r.pump;
  }, []);

  const connect = async () => {
    const serial = (navigator as unknown as { serial?: SerialLike }).serial;
    if (!serial) {
      setConn("unsupported");
      return;
    }
    try {
      setError("");
      setConn("connecting");
      const port = await serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      keepReading.current = true;
      setConn("connected");

      const decoder = new TextDecoderStream();
      const closed = port.readable!.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => {});
      const reader = decoder.readable.getReader();
      readerRef.current = reader;

      let buf = "";
      while (keepReading.current) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        parts.forEach(onLine);
      }
      reader.releaseLock();
      await closed;
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      setError(
        name === "NotFoundError"
          ? "No port selected."
          : name === "NetworkError"
            ? "Could not open the port. Close the Arduino Serial Monitor and try again."
            : e instanceof Error ? e.message : "Connection failed.",
      );
      setConn("error");
    }
  };

  const disconnect = async () => {
    keepReading.current = false;
    try { await readerRef.current?.cancel(); } catch { /* ignore */ }
    try { await portRef.current?.close(); } catch { /* ignore */ }
    setConn("idle");
    setCurrent(null);
  };

  const connected = conn === "connected";

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">🌱 Plant Irrigation</h1>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-line px-3 py-1 text-sm text-dim">
              Arduino: <b className={connected ? "text-leaf" : "text-warn"}>{connected ? "connected" : conn}</b>
            </span>
            {connected ? (
              <button onClick={disconnect} className="rounded-full border border-line px-5 py-2 text-sm font-medium text-dim">
                Disconnect
              </button>
            ) : (
              <button onClick={connect} disabled={conn === "connecting"} className="rounded-full bg-leaf px-5 py-2 text-sm font-bold text-background disabled:opacity-50">
                Connect to Arduino
              </button>
            )}
          </div>
        </header>

        {conn === "unsupported" && (
          <div className="mb-6 rounded-2xl border border-warn p-4 text-sm">
            This browser cannot read USB devices. Open the dashboard in Chrome or Edge on a laptop.
          </div>
        )}
        {error && <div className="mb-6 rounded-2xl border border-warn p-4 text-sm">{error}</div>}
        {conn === "idle" && (
          <p className="mb-4 text-sm text-dim">Close the Arduino Serial Monitor first, then click Connect.</p>
        )}
        {connected && !current && <p className="mb-4 text-sm text-dim">Connected. Waiting for the first reading…</p>}

        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Soil">
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <div className={`h-20 w-20 rounded-full ${current ? (current.dry ? "bg-warn" : "bg-leaf") : "bg-line"}`} />
              <p className="text-2xl font-bold">{current ? (current.dry ? "Dry" : "Wet") : "—"}</p>
              <p className="text-sm text-dim">Set the dry/wet point with the screw on the sensor</p>
            </div>
          </Card>
          <Card title="Pump">
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <div className={`h-20 w-20 rounded-full ${current?.pump ? "bg-water animate-pulse" : "bg-line"}`} />
              <p className="text-2xl font-bold">{current ? (current.pump ? "Running" : "Off") : "—"}</p>
              <p className="text-sm text-dim">Controlled by the Arduino</p>
            </div>
          </Card>
          <Card title="Watering runs">
            <div className="flex flex-col items-center justify-center gap-3 py-6">
              <p className="text-6xl font-bold">{runs}</p>
              <p className="text-sm text-dim">Since you opened this page</p>
            </div>
          </Card>
        </div>

        <Card title={`Last ${MAX_READINGS} readings`} className="mt-4">
          <Chart values={history} />
        </Card>

        <Card title="Watering log" className="mt-4">
          {log.length === 0 ? (
            <p className="text-sm text-dim">Nothing yet.</p>
          ) : (
            <ul className="text-sm">
              {log.map((l, i) => (
                <li key={i} className="border-t border-line py-2 first:border-t-0">{l}</li>
              ))}
            </ul>
          )}
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

function Chart({ values }: { values: Reading[] }) {
  const W = 600, H = 120;
  if (values.length < 2) return <p className="py-12 text-center text-dim">Waiting for readings…</p>;
  const step = W / (MAX_READINGS - 1);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--line)" />
        {values.map((v, i) => (
          <rect key={i} x={i * step} y={v.dry ? 8 : H / 2 + 8} width={Math.max(step - 1, 1)} height={H / 2 - 16}
            fill={v.dry ? "var(--warn)" : "var(--leaf)"} opacity={v.pump ? 1 : 0.55} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-dim">
        <span>Top: dry · Bottom: wet · Solid bars: pump on</span>
        <span>now</span>
      </div>
    </div>
  );
}