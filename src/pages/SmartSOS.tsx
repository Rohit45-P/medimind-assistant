import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { QRCodeSVG } from "qrcode.react";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// ─── Types ────────────────────────────────────────────────────────────────────
interface VitalSnapshot {
  time: string;
  pulse: number;
  temp: number;
}

type MotionStatus = "Normal" | "Fall Detected" | "No Movement";

// ─── Constants ────────────────────────────────────────────────────────────────
const NORMAL_PULSE = { min: 60, max: 100 };
const NORMAL_TEMP = { min: 97, max: 99.5 };
const HISTORY_SIZE = 20;

function randomBetween(a: number, b: number) {
  return +(a + Math.random() * (b - a)).toFixed(1);
}

function getTimeLabel() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function detectEmergency(pulse: number, temp: number, motion: MotionStatus) {
  const reasons: string[] = [];
  if (pulse > 130) reasons.push(`High pulse (${pulse} BPM > 130)`);
  if (temp > 102) reasons.push(`High temperature (${temp}°F > 102°F)`);
  if (motion === "Fall Detected") reasons.push("Fall detected");
  if (motion === "No Movement") reasons.push("No movement detected");
  return { triggered: reasons.length > 0, reasons };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SmartSOS() {
  const [pulse, setPulse] = useState(72);
  const [temp, setTemp] = useState(98.6);
  const [motion, setMotion] = useState<MotionStatus>("Normal");
  const [history, setHistory] = useState<VitalSnapshot[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [emergency, setEmergency] = useState<{ triggered: boolean; reasons: string[] }>({ triggered: false, reasons: [] });
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertTime, setAlertTime] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [caregiverNotified, setCaregiverNotified] = useState(false);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevEmergencyRef = useRef(false);
  // 30-second cooldown so we don't spam the backend on every auto tick
  const cooldownRef = useRef(false);

  // Push history snapshot
  const pushHistory = useCallback((p: number, t: number) => {
    setHistory((h) => {
      const next = [...h, { time: getTimeLabel(), pulse: p, temp: t }];
      return next.slice(-HISTORY_SIZE);
    });
  }, []);

  // Auto-simulation tick
  useEffect(() => {
    if (!isAutoMode) return;
    intervalRef.current = setInterval(() => {
      const p = randomBetween(55, 155);
      const t = randomBetween(96.5, 104.5);
      setPulse(p);
      setTemp(t);
      pushHistory(p, t);
    }, 2000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isAutoMode, pushHistory]);

  // Manual mode: still track history on value changes
  useEffect(() => {
    if (!isAutoMode) {
      pushHistory(pulse, temp);
    }
  }, [pulse, temp, isAutoMode]);

  // ── Real API call: notify caregiver via backend ──────────────────────────
  const sendAutoAlert = useCallback(async (
    p: number, t: number, m: MotionStatus, reasons: string[]
  ) => {
    if (cooldownRef.current) return; // respect 30-second cooldown
    cooldownRef.current = true;
    setSendStatus("sending");
    try {
      await apiFetch("/api/emergency/auto-alert", {
        method: "POST",
        body: JSON.stringify({
          pulse: p,
          temperature: t,
          motion: m,
          trigger_reasons: reasons,
        }),
      });
      setSendStatus("sent");
    } catch {
      // API unavailable (backend down / not logged in) — degrade gracefully
      setSendStatus("failed");
    }
    // Reset cooldown after 30 s so the next distinct emergency can re-alert
    setTimeout(() => { cooldownRef.current = false; }, 30_000);
  }, []);

  // Emergency detection
  useEffect(() => {
    const result = detectEmergency(pulse, temp, motion);
    setEmergency(result);
    if (result.triggered && !prevEmergencyRef.current) {
      setAlertDismissed(false);
      setAlertTime(getTimeLabel());
      setAlertCount((c) => c + 1);
      setCaregiverNotified(true);
      setSendStatus("idle");
      setTimeout(() => setCaregiverNotified(false), 8000);
      // Fire the real backend call
      sendAutoAlert(pulse, temp, motion, result.reasons);
    }
    prevEmergencyRef.current = result.triggered;
  }, [pulse, temp, motion, sendAutoAlert]);

  const isAlert = emergency.triggered && !alertDismissed;

  const pulseStatus = pulse > 130 ? "critical" : pulse > 100 ? "warning" : pulse < 50 ? "critical" : "normal";
  const tempStatus = temp > 102 ? "critical" : temp > 99.5 ? "warning" : temp < 96.5 ? "warning" : "normal";
  const motionStatus = motion === "Fall Detected" ? "critical" : motion === "No Movement" ? "warning" : "normal";

  // Chart data
  const chartData = {
    labels: history.map((h) => h.time),
    datasets: [
      {
        label: "Pulse (BPM)",
        data: history.map((h) => h.pulse),
        borderColor: pulseStatus === "critical" ? "#ef4444" : pulseStatus === "warning" ? "#f59e0b" : "#10b981",
        backgroundColor: pulseStatus === "critical" ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.07)",
        fill: true,
        tension: 0.4,
        yAxisID: "y",
        pointRadius: 2,
      },
      {
        label: "Temp (°F)",
        data: history.map((h) => h.temp),
        borderColor: tempStatus === "critical" ? "#f97316" : "#6366f1",
        backgroundColor: "rgba(99,102,241,0.05)",
        fill: false,
        tension: 0.4,
        yAxisID: "y1",
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 } as const,
    plugins: {
      legend: { labels: { color: "#94a3b8", font: { size: 11 } } },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { ticks: { color: "#64748b", font: { size: 9 } }, grid: { color: "rgba(100,116,139,0.1)" } },
      y: { position: "left" as const, ticks: { color: "#64748b" }, grid: { color: "rgba(100,116,139,0.1)" }, title: { display: true, text: "BPM", color: "#94a3b8" } },
      y1: { position: "right" as const, ticks: { color: "#64748b" }, grid: { display: false }, title: { display: true, text: "°F", color: "#94a3b8" } },
    },
  };

  return (
    <div className={`min-h-screen transition-all duration-500 ${isAlert ? "sos-alert-bg" : "bg-[#0a0f1e]"}`}>
      {/* Red flashing overlay when emergency */}
      {isAlert && (
        <div className="fixed inset-0 pointer-events-none z-30 sos-flash-overlay" />
      )}

      {/* Caregiver notification toast */}
      {caregiverNotified && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right border border-red-400">
          <span className="text-2xl">📟</span>
          <div>
            <div className="font-bold text-sm">🚨 Auto-SOS Fired!</div>
            <div className="text-xs opacity-90">
              {sendStatus === "sending" && "⏳ Notifying caregiver dashboard…"}
              {sendStatus === "sent" && "✅ Caregiver dashboard notified in real-time!"}
              {sendStatus === "failed" && "⚠️ Simulated — caregiver alert shown in demo"}
              {sendStatus === "idle" && "Sending alert to caregiver…"}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full ${isAlert ? "bg-red-500 animate-ping-red" : "bg-emerald-400 animate-pulse"}`} />
              <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Smart Auto SOS Simulation</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white">
              🧠 AI Emergency Detection
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Automatic emergency detection — no hardware, no buttons, no voice needed
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border ${
              isAlert ? "bg-red-500/20 border-red-500 text-red-300 animate-pulse" : "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
            }`}>
              {isAlert ? "🚨 EMERGENCY ACTIVE" : "✅ MONITORING NORMAL"}
            </div>
            <button
              onClick={() => { setIsAutoMode((a) => !a); }}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
                isAutoMode ? "bg-violet-500/20 border-violet-500 text-violet-300" : "bg-slate-700/50 border-slate-600 text-slate-400"
              }`}
            >
              {isAutoMode ? "⚡ Auto Mode ON" : "🔧 Manual Mode"}
            </button>
            <div className="text-xs text-slate-500 font-mono">SOS Triggered: {alertCount}x</div>
          </div>
        </div>

        {/* ── Emergency Alert Popup ── */}
        {isAlert && (
          <div className="relative rounded-3xl border-2 border-red-500 bg-gradient-to-br from-red-950/80 to-red-900/60 backdrop-blur-xl p-6 shadow-[0_0_60px_rgba(239,68,68,0.4)] overflow-hidden">
            <div className="absolute inset-0 rounded-3xl sos-border-flash pointer-events-none" />
            <div className="flex flex-wrap items-start gap-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-ping-pulse shrink-0">
                  <span className="text-4xl">🚨</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-red-300">EMERGENCY DETECTED</h2>
                  <p className="text-red-400 text-sm mt-0.5">Auto-SOS triggered at {alertTime}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {emergency.reasons.map((r, i) => (
                      <span key={i} className="text-xs bg-red-500/20 border border-red-500/50 text-red-300 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ml-auto flex flex-col gap-2 shrink-0">
                <div className="bg-white p-3 rounded-xl shadow-lg">
                  <QRCodeSVG value="https://medimind.app/emergency/demo-patient" size={100} level="H" />
                </div>
                <span className="text-[10px] text-red-400 text-center">Emergency QR Access</span>
              </div>
            </div>

            <div className="mt-4 grid md:grid-cols-3 gap-3">
              <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-red-300">{pulse} <span className="text-sm font-normal">BPM</span></div>
                <div className="text-xs text-red-400">Critical Pulse Rate</div>
              </div>
              <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-orange-300">{temp}°F</div>
                <div className="text-xs text-red-400">Critical Temperature</div>
              </div>
              <div className="bg-red-900/40 border border-red-700/50 rounded-xl p-3 text-center">
                <div className="text-xl font-black text-yellow-300">{motion}</div>
                <div className="text-xs text-red-400">Motion Status</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <div className="flex-1 bg-red-800/30 border border-red-600/40 rounded-xl p-3 text-sm text-red-300 space-y-1">
                <div>
                  {sendStatus === "sending" && <span>⏳ <strong>Sending auto-alert</strong> to caregiver dashboard…</span>}
                  {sendStatus === "sent" && <span>✅ <strong>Caregiver notified!</strong> Alert visible on caregiver dashboard with vitals.</span>}
                  {sendStatus === "failed" && <span>⚠️ <strong>Demo mode</strong> — alert simulated (log in as patient to send real alerts)</span>}
                  {sendStatus === "idle" && <span>📟 <strong>Auto-alert</strong> being prepared…</span>}
                </div>
                <div className="text-xs text-red-400/70">🤖 Detected via: Pulse {pulse} BPM · Temp {temp}°F · Motion: {motion}</div>
              </div>
              <button
                onClick={() => setAlertDismissed(true)}
                className="px-5 py-2 bg-slate-700 border border-slate-500 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-600 transition-all"
              >
                Dismiss Alert
              </button>
            </div>
          </div>
        )}

        {/* ── Vital Metric Cards ── */}
        <div className="grid md:grid-cols-3 gap-4">
          <VitalCard
            icon="❤️"
            label="Pulse Rate"
            value={`${pulse}`}
            unit="BPM"
            status={pulseStatus}
            normal={`${NORMAL_PULSE.min}–${NORMAL_PULSE.max}`}
            threshold="> 130 triggers SOS"
            progress={Math.min((pulse / 180) * 100, 100)}
          />
          <VitalCard
            icon="🌡️"
            label="Body Temperature"
            value={`${temp}`}
            unit="°F"
            status={tempStatus}
            normal={`${NORMAL_TEMP.min}–${NORMAL_TEMP.max}`}
            threshold="> 102°F triggers SOS"
            progress={Math.min(((temp - 95) / (106 - 95)) * 100, 100)}
          />
          <MotionCard motion={motion} status={motionStatus} />
        </div>

        {/* ── Chart + Manual Controls ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Vitals Chart */}
          <div className="lg:col-span-2 bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span>📈</span> Live Vitals Monitor
              <span className="ml-auto text-xs text-slate-500 font-mono animate-pulse">● LIVE</span>
            </h3>
            <div className="h-52">
              {history.length > 1 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 text-sm">Collecting data…</div>
              )}
            </div>
          </div>

          {/* Manual Simulation Controls */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2">🎛️ Simulate Emergency</h3>

            {/* Pulse slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Pulse Rate</span>
                <span className={`font-bold ${pulseStatus === "critical" ? "text-red-400" : pulseStatus === "warning" ? "text-yellow-400" : "text-emerald-400"}`}>{pulse} BPM</span>
              </div>
              <input
                type="range" min={30} max={180} value={pulse}
                onChange={(e) => { setIsAutoMode(false); setPulse(+e.target.value); }}
                className="w-full accent-red-500"
              />
            </div>

            {/* Temp slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Temperature</span>
                <span className={`font-bold ${tempStatus === "critical" ? "text-red-400" : tempStatus === "warning" ? "text-yellow-400" : "text-emerald-400"}`}>{temp}°F</span>
              </div>
              <input
                type="range" min={95} max={106} step={0.1} value={temp}
                onChange={(e) => { setIsAutoMode(false); setTemp(+e.target.value); }}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Motion buttons */}
            <div>
              <div className="text-xs text-slate-400 mb-2">Motion Status</div>
              <div className="grid grid-cols-1 gap-2">
                {(["Normal", "Fall Detected", "No Movement"] as MotionStatus[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setIsAutoMode(false); setMotion(m); }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      motion === m
                        ? m === "Normal" ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                          : "bg-red-500/20 border-red-500 text-red-300"
                        : "bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400"
                    }`}
                  >
                    {m === "Normal" ? "✅" : m === "Fall Detected" ? "🚨" : "⛔"} {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Preset buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Quick Presets</div>
              <button
                onClick={() => { setIsAutoMode(false); setPulse(145); setTemp(103.2); setMotion("No Movement"); }}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-red-600/20 border border-red-500/60 text-red-300 hover:bg-red-600/30 transition-all"
              >
                🚨 Trigger Emergency Scenario
              </button>
              <button
                onClick={() => { setIsAutoMode(false); setPulse(75); setTemp(98.4); setMotion("Normal"); setAlertDismissed(false); }}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600/20 border border-emerald-500/60 text-emerald-300 hover:bg-emerald-600/30 transition-all"
              >
                ✅ Reset to Normal
              </button>
              <button
                onClick={() => setIsAutoMode(true)}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-violet-600/20 border border-violet-500/60 text-violet-300 hover:bg-violet-600/30 transition-all"
              >
                ⚡ Random Auto Simulation
              </button>
            </div>
          </div>
        </div>

        {/* ── Detection Logic Explainer ── */}
        <div className="grid md:grid-cols-3 gap-4">
          <LogicCard icon="💓" label="Pulse > 130 BPM" met={pulse > 130} value={`${pulse} BPM`} />
          <LogicCard icon="🌡️" label="Temp > 102°F" met={temp > 102} value={`${temp}°F`} />
          <LogicCard icon="🏃" label="Fall / No Movement" met={motion !== "Normal"} value={motion} />
        </div>

        {/* ── Info Footer ── */}
        <div className="bg-slate-900/40 border border-slate-700/30 rounded-2xl p-5 text-center">
          <p className="text-slate-400 text-sm">
            <span className="text-violet-400 font-semibold">🧠 Smart Auto SOS</span> — Detects emergencies automatically even when the patient cannot type, speak, or press any button.
            No wearable hardware required for this demo.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Vital Card ───────────────────────────────────────────────────────────────
function VitalCard({ icon, label, value, unit, status, normal, threshold, progress }: {
  icon: string; label: string; value: string; unit: string;
  status: "normal" | "warning" | "critical"; normal: string; threshold: string; progress: number;
}) {
  const colors = {
    normal: { border: "border-emerald-500/40", text: "text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500", glow: "" },
    warning: { border: "border-yellow-500/60", text: "text-yellow-400", bg: "bg-yellow-500/10", bar: "bg-yellow-500", glow: "shadow-[0_0_20px_rgba(234,179,8,0.3)]" },
    critical: { border: "border-red-500/70", text: "text-red-400", bg: "bg-red-500/10", bar: "bg-red-500", glow: "shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse" },
  }[status];

  return (
    <div className={`bg-slate-900/70 backdrop-blur-xl border rounded-2xl p-5 transition-all duration-500 ${colors.border} ${colors.glow}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-2xl mb-1">{icon}</div>
          <div className="text-slate-400 text-xs uppercase tracking-wider">{label}</div>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${colors.bg} ${colors.border} ${colors.text}`}>
          {status}
        </span>
      </div>
      <div className={`text-4xl font-black mb-1 ${colors.text}`}>{value}<span className="text-lg font-normal text-slate-500 ml-1">{unit}</span></div>
      <div className="mt-3 mb-1">
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 mt-1">
        <span>Normal: {normal}</span>
        <span>{threshold}</span>
      </div>
    </div>
  );
}

// ─── Motion Card ──────────────────────────────────────────────────────────────
function MotionCard({ motion, status }: { motion: MotionStatus; status: "normal" | "warning" | "critical" }) {
  const icon = motion === "Normal" ? "🚶" : motion === "Fall Detected" ? "🆘" : "🛑";
  const colors = {
    normal: { border: "border-emerald-500/40", text: "text-emerald-400", glow: "" },
    warning: { border: "border-yellow-500/60", text: "text-yellow-400", glow: "shadow-[0_0_20px_rgba(234,179,8,0.3)]" },
    critical: { border: "border-red-500/70", text: "text-red-400", glow: "shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse" },
  }[status];

  return (
    <div className={`bg-slate-900/70 backdrop-blur-xl border rounded-2xl p-5 flex flex-col justify-between transition-all duration-500 ${colors.border} ${colors.glow}`}>
      <div>
        <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Motion Status</div>
        <div className="text-6xl mb-3 text-center">{icon}</div>
        <div className={`text-2xl font-black text-center ${colors.text}`}>{motion}</div>
      </div>
      <div className={`mt-4 text-[11px] text-center text-slate-500`}>
        Fall or No Movement → Auto SOS triggered
      </div>
    </div>
  );
}

// ─── Logic Card ───────────────────────────────────────────────────────────────
function LogicCard({ icon, label, met, value }: { icon: string; label: string; met: boolean; value: string }) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 transition-all duration-500 ${
      met ? "bg-red-950/40 border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]" : "bg-slate-900/50 border-slate-700/40"
    }`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${met ? "bg-red-500/20 animate-pulse" : "bg-slate-800"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-semibold ${met ? "text-red-300" : "text-slate-400"}`}>{label}</div>
        <div className={`text-lg font-black ${met ? "text-red-400" : "text-slate-500"}`}>{value}</div>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shrink-0 ${met ? "bg-red-500" : "bg-slate-700"}`}>
        {met ? "✓" : "–"}
      </div>
    </div>
  );
}
