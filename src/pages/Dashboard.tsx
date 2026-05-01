import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Activity, Bell, Brain, Mic, Check, Volume2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { speak, listen, requestNotificationPermission, showNotification } from "@/lib/voice";
import { generateInsights, calculateHealthScore, MedLog, HealthLog } from "@/lib/insights";
import { toast } from "sonner";

interface Med {
  id: string;
  name: string;
  dosage: string;
  times: string[];
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [meds, setMeds] = useState<Med[]>([]);
  const [logs, setLogs] = useState<MedLog[]>([]);
  const [health, setHealth] = useState<HealthLog[]>([]);
  const [now, setNow] = useState(new Date());
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (user) load(); }, [user]);
  useEffect(() => { requestNotificationPermission(); }, []);

  // Smart reminder loop: warns 5 min before, alerts on time, escalates if overdue
  useEffect(() => {
    const checked = new Set<string>();
    const id = setInterval(() => {
      const nowD = new Date();
      const today = nowD.toISOString().slice(0, 10);
      const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
      meds.forEach((m) => {
        m.times.forEach((t) => {
          const [hh, mm] = t.split(":").map(Number);
          const schedMin = hh * 60 + mm;
          const diff = schedMin - nowMin;
          const alreadyLogged = logs.some(
            (l) => l.medication_id === m.id && l.scheduled_time === t && l.scheduled_date === today
          );
          if (alreadyLogged) return;

          // 5 min advance warning
          const warnKey = `warn-${m.id}-${t}-${today}`;
          if (diff === 5 && !checked.has(warnKey)) {
            checked.add(warnKey);
            toast(`⏰ ${m.name} in 5 minutes`, { description: m.dosage });
          }
          // On-time alert
          const dueKey = `due-${m.id}-${t}-${today}`;
          if (diff === 0 && !checked.has(dueKey)) {
            checked.add(dueKey);
            showNotification("MediRecall — time for your dose", `${m.name}${m.dosage ? ` (${m.dosage})` : ""}`);
            speak(`It's time to take your ${m.name}`);
            toast(`💊 Time for ${m.name}`, { description: m.dosage, duration: 10000 });
          }
          // Overdue escalation at 15 min
          const overKey = `over-${m.id}-${t}-${today}`;
          if (diff === -15 && !checked.has(overKey)) {
            checked.add(overKey);
            showNotification("⚠️ Dose overdue", `${m.name} was scheduled 15 min ago`);
            speak(`Reminder: your ${m.name} dose is overdue`);
            toast.warning(`${m.name} is 15 min overdue`, { duration: 12000 });
          }
        });
      });
    }, 30 * 1000);
    return () => clearInterval(id);
  }, [meds, logs]);

  // Realtime sync from caregiver actions or other devices
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("dash-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_logs", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "medications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function load() {
    if (!user) return;
    const [{ data: m }, { data: l }, { data: h }] = await Promise.all([
      supabase.from("medications").select("*").eq("user_id", user.id).eq("active", true).order("created_at"),
      supabase.from("medication_logs").select("*").eq("user_id", user.id).order("taken_at", { ascending: false }).limit(200),
      supabase.from("health_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    ]);
    setMeds((m || []) as Med[]);
    setLogs((l || []) as MedLog[]);
    setHealth((h || []) as HealthLog[]);
  }

  const today = now.toISOString().slice(0, 10);
  const todaysSchedule = useMemo(() => {
    const items: { med: Med; time: string; logged?: MedLog }[] = [];
    meds.forEach((m) => m.times.forEach((t) => {
      const logged = logs.find((l) => l.medication_id === m.id && l.scheduled_time === t && l.scheduled_date === today);
      items.push({ med: m, time: t, logged });
    }));
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [meds, logs, today]);

  const insights = useMemo(() => generateInsights(logs, health), [logs, health]);
  const score = useMemo(() => calculateHealthScore(logs), [logs]);

  async function logDose(med: Med, time: string, status: "taken" | "missed") {
    if (!user) return;
    await supabase.from("medication_logs").insert({
      user_id: user.id, medication_id: med.id, scheduled_time: time, scheduled_date: today, status,
    });
    if (status === "taken") {
      toast.success(`${med.name} logged ✓`);
      speak(`Good job. ${med.name} marked as taken.`);
    } else {
      toast(`${med.name} marked as missed`);
    }
    load();
  }

  async function logSymptom(value: string) {
    if (!user) return;
    await supabase.from("health_logs").insert({ user_id: user.id, type: "symptom", value });
    toast.success(`Logged: ${value}`);
    load();
  }

  function handleVoice() {
    setListening(true);
    const session = listen((text) => {
      const t = text.toLowerCase();
      toast(`Heard: "${text}"`);
      if (t.includes("took") || t.includes("taken")) {
        const next = todaysSchedule.find((s) => !s.logged);
        if (next) logDose(next.med, next.time, "taken");
        else toast("Nothing scheduled to log right now");
      } else if (t.includes("headache") || t.includes("pain") || t.includes("nausea") || t.includes("dizzy") || t.includes("tired")) {
        const sym = ["headache","pain","nausea","dizziness","fatigue"].find(s => t.includes(s.slice(0,4))) || "symptom";
        logSymptom(sym);
      } else {
        toast("Try: 'I took my medicine' or 'I have a headache'");
      }
    }, () => setListening(false));
    if (!session) {
      setListening(false);
      toast.error("Voice recognition not supported in this browser");
    }
  }

  const nextDose = todaysSchedule.find((s) => !s.logged);
  const countdown = useMemo(() => {
    if (!nextDose) return null;
    const [h, m] = nextDose.time.split(":").map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    const diffMs = target.getTime() - now.getTime();
    if (diffMs < -60 * 60 * 1000) return null;
    const mins = Math.round(diffMs / 60000);
    if (mins > 60) return `in ${Math.floor(mins/60)}h ${mins%60}m`;
    if (mins > 0) return `in ${mins} min`;
    if (mins === 0) return "right now";
    return `${Math.abs(mins)} min overdue`;
  }, [nextDose, now]);
  const isOverdue = countdown?.includes("overdue");

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Hello, {profile?.full_name?.split(" ")[0] || "friend"} 👋</h1>
          <p className="text-muted-foreground mt-1">Here's your health overview for today.</p>
        </div>
        <Button onClick={handleVoice} disabled={listening} variant="outline" className="hover-bounce">
          <Mic className={`w-4 h-4 mr-2 ${listening ? "text-destructive animate-pulse-soft" : ""}`} />
          {listening ? "Listening…" : "Voice command"}
        </Button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Pill} label="Today's doses" value={`${todaysSchedule.filter(s=>s.logged?.status==="taken").length}/${todaysSchedule.length}`} accent="primary" delay={0} />
        <StatCard icon={Activity} label="Health score" value={`${score}`} suffix="/100" accent="success" delay={0.05} />
        <StatCard icon={Bell} label="Active medications" value={meds.length.toString()} accent="accent" delay={0.1} />
        <StatCard icon={Brain} label="Active insights" value={insights.length.toString()} accent="warning" delay={0.15} />
      </div>

      {/* Hero next-dose */}
      {nextDose ? (
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant animate-scale-in ${isOverdue ? "ring-4 ring-destructive/60 animate-pulse-soft" : ""}`}>
          <div className="absolute -right-8 -bottom-8 opacity-20 animate-float">
            <Pill className="w-48 h-48" />
          </div>
          <div className="relative">
            <div className="text-sm opacity-90 mb-1 flex items-center gap-2">
              <span className="inline-flex w-2 h-2 rounded-full bg-white animate-pulse-soft" />
              Next up at {nextDose.time} {countdown && <span className="font-semibold">· {countdown}</span>}
            </div>
            <div className="text-3xl md:text-4xl font-bold mb-1">{nextDose.med.name}</div>
            {nextDose.med.dosage && <div className="opacity-90">{nextDose.med.dosage}</div>}
            <div className="flex flex-wrap gap-3 mt-5">
              <Button onClick={() => logDose(nextDose.med, nextDose.time, "taken")} className="bg-card text-foreground hover:bg-card/90 hover-bounce">
                <Check className="w-4 h-4 mr-2" /> Mark as taken
              </Button>
              <Button onClick={() => speak(`It's time to take your ${nextDose.med.name}`)} variant="ghost" className="text-primary-foreground hover:bg-white/10">
                <Volume2 className="w-4 h-4 mr-2" /> Voice reminder
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl glass-card p-8 text-center animate-scale-in">
          <div className="text-2xl font-semibold mb-2">All caught up for today 🎉</div>
          <p className="text-muted-foreground">No remaining doses scheduled. Great work!</p>
        </div>
      )}

      {/* Today's schedule + insights */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Today's schedule</h2>
            <Link to="/medications"><Button size="sm" variant="ghost" className="hover-bounce"><Plus className="w-4 h-4 mr-1" />Add</Button></Link>
          </div>
          {todaysSchedule.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="mb-3">No medications added yet.</p>
              <Link to="/medications"><Button className="bg-gradient-primary text-primary-foreground hover-bounce">Add your first medication</Button></Link>
            </div>
          ) : (
            <div className="space-y-2">
              {todaysSchedule.map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover-bounce">
                  <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
                    <Pill className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{s.med.name}</div>
                    <div className="text-sm text-muted-foreground">{s.time} {s.med.dosage && `• ${s.med.dosage}`}</div>
                  </div>
                  {s.logged ? (
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${s.logged.status === "taken" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {s.logged.status}
                    </span>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => logDose(s.med, s.time, "missed")} className="text-muted-foreground">Skip</Button>
                      <Button size="sm" onClick={() => logDose(s.med, s.time, "taken")} className="bg-gradient-primary text-primary-foreground hover-bounce">
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Brain className="w-5 h-5 text-accent" /> Insights</h2>
          <div className="space-y-3">
            {insights.slice(0, 4).map((i) => (
              <div key={i.id} className={`p-4 rounded-xl border-l-4 ${
                i.severity === "alert" ? "bg-destructive/5 border-destructive" :
                i.severity === "warning" ? "bg-warning/5 border-warning" :
                "bg-success/5 border-success"
              }`}>
                <div className="font-semibold text-sm mb-1">{i.title}</div>
                <div className="text-xs text-muted-foreground">{i.description}</div>
              </div>
            ))}
          </div>
          <Link to="/insights"><Button variant="ghost" size="sm" className="w-full mt-4 hover-bounce">View all insights →</Button></Link>
        </div>
      </div>

      {/* Quick symptom log */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-3">Quick log</h2>
        <p className="text-sm text-muted-foreground mb-4">Tap a symptom or mood to log it instantly.</p>
        <div className="flex flex-wrap gap-2">
          {["Headache","Nausea","Fatigue","Dizziness","Pain","Happy","Anxious","Calm"].map((s) => (
            <Button key={s} variant="outline" size="sm" onClick={() => logSymptom(s)} className="hover-bounce">{s}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix, accent, delay = 0 }: { icon: any; label: string; value: string; suffix?: string; accent: "primary"|"success"|"accent"|"warning"; delay?: number }) {
  const styles = {
    primary: "from-primary to-primary-glow text-primary-foreground",
    success: "from-success to-success/70 text-success-foreground",
    accent: "from-accent to-accent/70 text-accent-foreground",
    warning: "from-warning to-warning/70 text-warning-foreground",
  }[accent];
  return (
    <div className="glass-card rounded-2xl p-5 hover-bounce animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className={`inline-flex w-10 h-10 rounded-xl bg-gradient-to-br ${styles} items-center justify-center mb-3 shadow-soft`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold">{value}<span className="text-base text-muted-foreground font-normal">{suffix}</span></div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
