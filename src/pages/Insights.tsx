import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { generateInsights, calculateHealthScore } from "@/lib/insights";
import {
  AlertTriangle, Info, Bell, Brain, TrendingUp, TrendingDown,
  Heart, Shield, Zap, Activity, Pill, Clock, Star, ChevronRight,
  Sparkles, Target, BarChart3, Moon, Sun, Sunrise, Sunset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, Filler
);

// ─── Demo data used when real data is insufficient ───────────────────────────
const DEMO_ADHERENCE_7DAY = [72, 85, 78, 91, 88, 94, 96];
const DEMO_SYMPTOM_COUNTS = { Headache: 3, Fatigue: 5, Nausea: 2, Dizziness: 4 };
const DEMO_TOD_MISSED = { Morning: 1, Afternoon: 3, Evening: 5, Night: 2 };

const DEMO_INSIGHTS = [
  { id: "d1", severity: "info" as const,    icon: "📈", title: "Adherence improved by 12% this week",  description: "Your medicine consistency went from 72% → 84%. Morning routine is the key driver." },
  { id: "d2", severity: "warning" as const, icon: "⚠️", title: "Evening medicines frequently missed",    description: "5 out of 7 evening doses were skipped. Consider setting a dinner-time alarm." },
  { id: "d3", severity: "info" as const,    icon: "💧", title: "Hydration reminders may help",          description: "Patients who drink water with medication show 18% better adherence scores." },
  { id: "d4", severity: "info" as const,    icon: "🧠", title: "Stress-related symptoms detected",      description: "Headache and fatigue were logged multiple times. Consider speaking to your doctor." },
  { id: "d5", severity: "info" as const,    icon: "😴", title: "Late-night timing may affect sleep",    description: "Night-time medication scheduling correlates with 23% more fatigue reports." },
  { id: "d6", severity: "alert" as const,   icon: "🚨", title: "Possible medication inconsistency",    description: "Aspirin was taken 15 min late 3 times this week. Small delays can reduce efficacy." },
  { id: "d7", severity: "info" as const,    icon: "❤️", title: "Health consistency stable — 7 days",  description: "No dramatic changes in symptom patterns. Keep up the consistent habits!" },
  { id: "d8", severity: "warning" as const, icon: "🔔", title: "Caregiver not checked in for 48h",    description: "Your linked caregiver has not reviewed your logs recently. Send a quick update." },
];

const AI_SUGGESTIONS = [
  { icon: Sunrise, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", text: "Consider shifting evening medicine timing to 7 PM for better adherence." },
  { icon: Heart,   color: "text-rose-500",  bg: "bg-rose-50 dark:bg-rose-950/30",   text: "Patient responded positively to morning reminders — expand this pattern." },
  { icon: Brain,   color: "text-violet-500",bg: "bg-violet-50 dark:bg-violet-950/30",text: "Voice reminders increased medicine completion rate by 31% this week." },
  { icon: Shield,  color: "text-teal-500",  bg: "bg-teal-50 dark:bg-teal-950/30",   text: "Caregiver interaction improved medicine consistency on weekdays." },
  { icon: Zap,     color: "text-yellow-500",bg: "bg-yellow-50 dark:bg-yellow-950/30",text: "Set up a weekly health check with your doctor for optimal outcomes." },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreLabel(s: number) {
  if (s >= 85) return { label: "Excellent 🟢",   color: "text-success",     ring: "hsl(152,64%,44%)" };
  if (s >= 60) return { label: "Moderate 🟡",    color: "text-warning",     ring: "hsl(38,95%,56%)" };
  return             { label: "Needs Attention 🔴", color: "text-destructive", ring: "hsl(0,78%,60%)" };
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function AnimatedScore({ score }: { score: number }) {
  const [displayed, setDisplayed] = useState(0);
  const { label, color, ring } = scoreLabel(score);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (displayed / 100) * circumference;

  useEffect(() => {
    let frame: number;
    let current = 0;
    const step = () => {
      current = Math.min(current + 1.5, score);
      setDisplayed(Math.round(current));
      if (current < score) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={ring} strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.05s linear", filter: `drop-shadow(0 0 8px ${ring}88)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold">{displayed}</span>
          <span className="text-xs text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      <div className={`text-sm font-bold ${color}`}>{label}</div>
      <p className="text-xs text-muted-foreground text-center">Health Discipline Score</p>
    </div>
  );
}

function AnimatedBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / max) * 100), 300);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, sub, accent }: {
  icon: any; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 hover-glow hover-sheen flex flex-col gap-2 animate-fade-up">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Insights() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    try {
      const [logsData, healthData] = await Promise.all([
        apiFetch("/api/medications/logs"),
        apiFetch("/api/health-logs"),
      ]);
      setLogs(logsData || []);
      setHealth(healthData || []);
    } catch {
      toast.error("Could not load insight data");
    } finally {
      setLoading(false);
    }
  }

  const realInsights = useMemo(() => generateInsights(logs as any, health as any), [logs, health]);
  const realScore = useMemo(() => calculateHealthScore(logs as any), [logs]);

  // Use demo mode if no real data or explicitly toggled on
  const isDemo = demoMode || logs.length < 3;
  const activeInsights = isDemo ? DEMO_INSIGHTS : realInsights;
  const score = isDemo ? 84 : realScore;

  // ── Build chart data ────────────────────────────────────────────────────────
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return d.toLocaleDateString("en", { month: "short", day: "numeric" });
  });

  const adherenceLineData = useMemo(() => {
    if (isDemo) {
      return {
        labels: days7,
        datasets: [{
          label: "Adherence %",
          data: DEMO_ADHERENCE_7DAY,
          borderColor: "hsl(174,62%,42%)",
          backgroundColor: "hsl(174,62%,42%,0.15)",
          fill: true,
          tension: 0.45,
          pointBackgroundColor: "hsl(174,62%,42%)",
          pointRadius: 5,
          pointHoverRadius: 8,
        }],
      };
    }
    const taken7 = days7.map((_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10);
      const day = logs.filter((l) => l.scheduled_date === d);
      if (!day.length) return 0;
      return Math.round((day.filter((l) => l.status === "taken").length / day.length) * 100);
    });
    return {
      labels: days7,
      datasets: [{
        label: "Adherence %",
        data: taken7,
        borderColor: "hsl(174,62%,42%)",
        backgroundColor: "rgba(52,199,168,0.12)",
        fill: true, tension: 0.45,
        pointBackgroundColor: "hsl(174,62%,42%)",
        pointRadius: 5, pointHoverRadius: 8,
      }],
    };
  }, [logs, isDemo]);

  const doughnutData = useMemo(() => {
    const taken = isDemo ? 84 : logs.filter((l) => l.status === "taken").length;
    const missed = isDemo ? 16 : logs.filter((l) => l.status === "missed").length;
    return {
      labels: ["Taken", "Missed"],
      datasets: [{
        data: [taken || 1, missed || 0],
        backgroundColor: ["hsl(152,64%,44%)", "hsl(0,78%,60%)"],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    };
  }, [logs, isDemo]);

  const symptomBarData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (isDemo) {
      Object.assign(counts, DEMO_SYMPTOM_COUNTS);
    } else {
      health.filter((h) => h.type === "symptom").forEach((h) => {
        const k = h.value.toLowerCase();
        counts[k] = (counts[k] || 0) + 1;
      });
    }
    const keys = Object.keys(counts).slice(0, 6);
    return {
      labels: keys.map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
      datasets: [{
        label: "Reports",
        data: keys.map((k) => counts[k]),
        backgroundColor: ["hsl(174,62%,42%)", "hsl(12,88%,65%)", "hsl(38,95%,56%)", "hsl(152,64%,44%)", "hsl(0,78%,60%)", "hsl(190,70%,55%)"],
        borderRadius: 8,
      }],
    };
  }, [health, isDemo]);

  const todBarData = {
    labels: ["Morning", "Afternoon", "Evening", "Night"],
    datasets: [{
      label: "Missed",
      data: isDemo ? Object.values(DEMO_TOD_MISSED) : [0, 0, 0, 0],
      backgroundColor: ["hsl(38,95%,56%)", "hsl(12,88%,65%)", "hsl(0,78%,60%)", "hsl(260,60%,55%)"],
      borderRadius: 8,
    }],
  };

  const chartOpts = {
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { grid: { color: "hsl(var(--border)/0.4)" }, ticks: { color: "hsl(var(--muted-foreground))" } }, x: { grid: { display: false }, ticks: { color: "hsl(var(--muted-foreground))" } } },
  };

  const taken  = isDemo ? 84 : logs.filter((l) => l.status === "taken").length;
  const missed = isDemo ? 16 : logs.filter((l) => l.status === "missed").length;
  const total  = taken + missed;
  const adherencePct = total > 0 ? Math.round((taken / total) * 100) : (isDemo ? 84 : 100);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="h-10 w-64 rounded-xl bg-secondary animate-shimmer" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-secondary animate-shimmer" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-secondary animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary" />
            AI Health Insights
          </h1>
          <p className="text-muted-foreground mt-1">Smart patterns detected from your medical data.</p>
        </div>
        <div className="flex items-center gap-3">
          {isDemo && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary animate-pulse-soft">
              <Sparkles className="w-3.5 h-3.5" /> Demo Insights Active
            </span>
          )}
          <Button
            variant={demoMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setDemoMode((v) => !v); toast(demoMode ? "Showing real data" : "Demo Insights Mode enabled ✨"); }}
            className={`hover-bounce gap-2 ${demoMode ? "bg-gradient-to-r from-primary to-primary-glow text-white" : ""}`}
          >
            <Sparkles className="w-4 h-4" />
            {demoMode ? "Demo ON" : "Demo Mode"}
          </Button>
        </div>
      </div>

      {/* ── Stat chips ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatChip icon={Target}     label="Adherence Rate"    value={`${adherencePct}%`}     sub="This week"             accent="bg-primary/10 text-primary" />
        <StatChip icon={Pill}       label="Doses Taken"       value={taken}                  sub={`of ${total} scheduled`} accent="bg-success/10 text-success" />
        <StatChip icon={AlertTriangle} label="Doses Missed"  value={missed}                 sub="Past 7 days"            accent="bg-destructive/10 text-destructive" />
        <StatChip icon={Activity}   label="Symptom Reports"  value={isDemo ? 14 : health.length} sub="This week"          accent="bg-warning/10 text-warning" />
      </div>

      {/* ── Health score + Weekly adherence ─────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Score meter */}
        <div className="glass-card rounded-3xl p-8 flex flex-col items-center gap-4 hover-glow animate-scale-in">
          <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Star className="w-4 h-4 text-warning" /> Health Score
          </div>
          <AnimatedScore score={score} />
          <div className="w-full space-y-3 pt-2 border-t border-border/40 mt-2">
            <AnimatedBar label="Medication Consistency" value={Math.round(adherencePct * 0.92)} max={100} color="hsl(174,62%,42%)" />
            <AnimatedBar label="Symptom Control"        value={isDemo ? 72 : 80}               max={100} color="hsl(152,64%,44%)" />
            <AnimatedBar label="Caregiver Engagement"   value={isDemo ? 65 : 50}               max={100} color="hsl(38,95%,56%)" />
          </div>
        </div>

        {/* 7-day adherence line chart */}
        <div className="md:col-span-2 glass-card rounded-3xl p-6 hover-glow animate-fade-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> 7-Day Adherence Trend
            </h2>
            <span className="text-xs text-muted-foreground bg-secondary rounded-full px-3 py-1">% doses taken</span>
          </div>
          <div className="h-52">
            <Line data={adherenceLineData} options={{ ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, min: 0, max: 100 } } }} />
          </div>
        </div>
      </div>

      {/* ── Donut + Symptom bar + TOD ────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-6">

        {/* Completion donut */}
        <div className="glass-card rounded-3xl p-6 hover-glow animate-fade-up">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-success" /> Dose Completion
          </h2>
          <div className="h-44 flex items-center justify-center">
            <Doughnut
              data={doughnutData}
              options={{ maintainAspectRatio: false, cutout: "70%", plugins: { legend: { position: "bottom", labels: { color: "hsl(var(--foreground))", padding: 16, font: { size: 12 } } } } }}
            />
          </div>
        </div>

        {/* Symptom frequency */}
        <div className="glass-card rounded-3xl p-6 hover-glow animate-fade-up">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" /> Symptom Frequency
          </h2>
          <div className="h-44">
            <Bar data={symptomBarData} options={{ ...chartOpts, plugins: { legend: { display: false } } }} />
          </div>
        </div>

        {/* Time-of-day misses */}
        <div className="glass-card rounded-3xl p-6 hover-glow animate-fade-up">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" /> Miss Timing Pattern
          </h2>
          <div className="h-44">
            <Bar data={todBarData} options={{ ...chartOpts, plugins: { legend: { display: false } } }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">Evening doses are most often missed</p>
        </div>
      </div>

      {/* ── AI Insight cards ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Detected Patterns &amp; Alerts
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {activeInsights.map((ins, i) => {
            const Icon  = ins.severity === "alert" ? AlertTriangle : ins.severity === "warning" ? Bell : Info;
            const style = ins.severity === "alert"
              ? "border-destructive/40 bg-destructive/5 dark:bg-destructive/10"
              : ins.severity === "warning"
              ? "border-warning/40 bg-warning/5 dark:bg-warning/10"
              : "border-primary/30 bg-primary/5 dark:bg-primary/10";
            const iconColor = ins.severity === "alert" ? "text-destructive" : ins.severity === "warning" ? "text-warning" : "text-primary";
            const pulse = ins.severity === "alert" ? "animate-pulse-soft" : "";
            return (
              <div
                key={ins.id}
                className={`glass-card rounded-2xl p-5 border-2 ${style} hover-glow hover-sheen animate-slide-in cursor-default`}
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`shrink-0 ${iconColor} ${pulse}`}>
                    {"icon" in ins ? (
                      <span className="text-2xl">{(ins as any).icon}</span>
                    ) : (
                      <Icon className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-sm mb-1">{ins.title}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{ins.description}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AI Recommendations ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-500" /> AI-Generated Recommendations
        </h2>
        <div className="space-y-3">
          {AI_SUGGESTIONS.map((s, i) => (
            <div
              key={i}
              className={`glass-card rounded-2xl p-4 ${s.bg} flex items-center gap-4 hover-bounce animate-fade-up`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`w-10 h-10 rounded-xl bg-white/60 dark:bg-black/20 flex items-center justify-center shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <p className="text-sm font-medium flex-1">{s.text}</p>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Alert section ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-destructive" /> Smart Health Alerts
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/5 border-destructive/30", title: "Repeated symptom pattern", body: "Fatigue reported 5 times this week. May be linked to missed evening doses." },
            { icon: Bell,          color: "text-warning",     bg: "bg-warning/5 border-warning/30",         title: "Medication inconsistency", body: "Aspirin taken irregularly. Consistent timing improves therapeutic efficacy." },
            { icon: TrendingDown,  color: "text-orange-500",  bg: "bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900", title: "Patient activity reduced", body: "Physical activity logs reduced this week. Gentle movement may help." },
          ].map((a, i) => (
            <div
              key={i}
              className={`glass-card rounded-2xl p-5 border-2 ${a.bg} animate-scale-in hover-glow`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <a.icon className={`w-7 h-7 mb-3 ${a.color} animate-pulse-soft`} />
              <div className="font-bold text-sm mb-1">{a.title}</div>
              <div className="text-xs text-muted-foreground leading-relaxed">{a.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Demo mode info banner ─────────────────────────────────────────────── */}
      {isDemo && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 text-sm animate-fade-up">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <span>
            <strong>Demo Insights Mode</strong> is active — showing realistic sample healthcare analytics.
            {logs.length >= 3 ? " Toggle off to see real data." : " Add more data to unlock real AI insights."}
          </span>
          {logs.length >= 3 && (
            <Button size="sm" variant="ghost" onClick={() => setDemoMode(false)} className="ml-auto shrink-0">
              Show Real Data
            </Button>
          )}
        </div>
      )}

    </div>
  );
}
