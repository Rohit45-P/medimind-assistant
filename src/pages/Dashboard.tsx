import { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api";
import { Pill, Activity, Bell, Brain, Check, Plus, HeartPulse, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link, useNavigate } from "react-router-dom";
import { speak, listen, requestNotificationPermission, showNotification, unlockAudio, playAlarmSound } from "@/lib/voice";
import { generateInsights, calculateHealthScore, MedLog, HealthLog } from "@/lib/insights";
import { toast } from "sonner";
import { Bar } from "react-chartjs-2";
import { QRCodeSVG } from "qrcode.react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/VoiceInputButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Med {
  id: string;
  name: string;
  dosage: string;
  times: string[];
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [meds, setMeds] = useState<Med[]>([]);
  const [logs, setLogs] = useState<MedLog[]>([]);
  const [health, setHealth] = useState<HealthLog[]>([]);
  const [now, setNow] = useState(new Date());
  const [listening, setListening] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [animType, setAnimType] = useState<"taken" | "missed" | null>(null);
  const [alarmMed, setAlarmMed] = useState<{med: Med, time: string} | null>(null);

  // Emergency Profile
  const [showEmergency, setShowEmergency] = useState(false);
  const [emBlood, setEmBlood] = useState(profile?.blood_group || "");
  const [emAllergies, setEmAllergies] = useState(profile?.allergies || "");
  const [emContacts, setEmContacts] = useState(profile?.emergency_contacts || "");
  const [emDiseases, setEmDiseases] = useState(profile?.diseases || "");
  const [savingEm, setSavingEm] = useState(false);


  // Trigger visual screen shake when alarm opens (simulates vibration for laptops)
  useEffect(() => {
    if (alarmMed) {
      document.body.classList.add("animate-vibrate-screen");
      const t = setTimeout(() => document.body.classList.remove("animate-vibrate-screen"), 800);
      return () => { clearTimeout(t); document.body.classList.remove("animate-vibrate-screen"); };
    }
  }, [alarmMed]);
  async function updateEmergencyProfile() {
    setSavingEm(true);
    try {
      await apiFetch("/api/patients/emergency-profile", {
        method: "PUT",
        body: JSON.stringify({
          blood_group: emBlood,
          allergies: emAllergies,
          emergency_contacts: emContacts,
          diseases: emDiseases,
        }),
      });
      toast.success("Emergency profile updated!");
    } catch {
      toast.error("Failed to save emergency profile");
    }
    setSavingEm(false);
  }

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  // Request notification permission and pre-warm audio/speech on first user interaction
  useEffect(() => {
    requestNotificationPermission();
    const unlock = () => { unlockAudio(); document.removeEventListener('click', unlock); document.removeEventListener('keydown', unlock); };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => { document.removeEventListener('click', unlock); document.removeEventListener('keydown', unlock); };
  }, []);

  const alarmCheckedRef = useRef(new Set<string>());

  // Smart reminder loop: warns 5 min before, alerts on time, escalates if overdue
  useEffect(() => {
    // Run immediately once, then every 5 seconds
    const checkAlarms = () => {
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

          const checked = alarmCheckedRef.current;

          // 5 min advance warning
          const warnKey = `warn-${m.id}-${t}-${today}`;
          if (diff === 5 && !checked.has(warnKey)) {
            checked.add(warnKey);
            toast(`⏰ ${m.name} in 5 minutes`, { description: m.dosage });
          }
          
          // On-time alert (triggers if diff is between 0 and -14 to catch missed exact minutes)
          const dueKey = `due-${m.id}-${t}-${today}`;
          if (diff <= 0 && diff > -15 && !checked.has(dueKey)) {
            checked.add(dueKey);
            showNotification("MediRecall — time for your dose", `${m.name}${m.dosage ? ` (${m.dosage})` : ""}`);
            
            speak(`It's time to take your ${m.name}`);

            toast(`💊 Time for ${m.name}`, { description: m.dosage, duration: 10000 });
            setAlarmMed({ med: m, time: t });
          }
          
          // Overdue escalation at 15 min or more
          const overKey = `over-${m.id}-${t}-${today}`;
          if (diff <= -15 && !checked.has(overKey)) {
            checked.add(overKey);
            showNotification("⚠️ Dose overdue", `${m.name} was scheduled ${Math.abs(diff)} min ago`);
            speak(`Reminder: your ${m.name} dose is overdue`);
            toast.warning(`${m.name} is ${Math.abs(diff)} min overdue`, { duration: 12000 });
          }
        });
      });
    };

    checkAlarms(); // initial check
    const id = setInterval(checkAlarms, 5 * 1000); // Check every 5 seconds
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
    try {
      const [allMedsData, allLogsData, allHealthData] = await Promise.all([
        apiFetch("/api/medications"),
        apiFetch("/api/medications/logs?limit=200"),
        apiFetch("/api/health-logs?limit=100"),
      ]);
      setMeds(((allMedsData || []) as any[]).filter((m: any) => m.active !== false) as Med[]);
      setLogs((allLogsData || []) as MedLog[]);
      setHealth((allHealthData || []) as HealthLog[]);
    } catch (err: any) {
      toast.error("Error loading data: " + err.message);
    }
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

  const adherenceData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      days.push(d.toISOString().slice(0, 10));
    }
    const taken = days.map((d) => logs.filter((l) => l.scheduled_date === d && l.status === "taken").length);
    const missed = days.map((d) => logs.filter((l) => l.scheduled_date === d && l.status === "missed").length);
    return {
      labels: days.map((d) => d.slice(5)),
      datasets: [
        { label: "Taken", data: taken, backgroundColor: "hsl(174 62% 42%)", borderRadius: 4 },
        { label: "Missed", data: missed, backgroundColor: "hsl(0 78% 60%)", borderRadius: 4 },
      ],
    };
  }, [logs]);

  async function logDose(med: Med, time: string, status: "taken" | "missed") {
    if (!user) return;
    
    const key = `${med.id}-${time}`;
    setAnimatingId(key);
    setAnimType(status);

    if (status === "taken") {
      toast.success(`${med.name} logged ✓`);
      speak(`Good job. ${med.name} marked as taken.`);
    } else {
      toast(`${med.name} marked as missed`);
    }

    setTimeout(async () => {
      await apiFetch("/api/medications/log", {
        method: "POST",
        body: JSON.stringify({ medication_id: med.id, scheduled_time: time, scheduled_date: today, status }),
      });
      setAnimatingId(null);
      setAnimType(null);
      load();
    }, 700);
  }

  async function logSymptom(value: string) {
    if (!user) return;
    try {
      await apiFetch("/api/patients/health-log", {
        method: "POST",
        body: JSON.stringify({ type: "symptom", value }),
      });
      toast.success(`✅ Logged: ${value}`);
      load();
    } catch (err: any) {
      toast.error("Failed to log symptom: " + (err.message || "Unknown error"));
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
        
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => {
              // Manual demo trigger
              const testMed = meds.length > 0 ? meds[0] : { id: "test", name: "Demo Medicine", dosage: "1 pill", times: [] };
              const t = new Date();
              const timeStr = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
              setAlarmMed({ med: testMed, time: timeStr });
            }} 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/10 hover-bounce shadow-soft"
          >
            <Bell className="w-4 h-4 mr-2" /> Simulate Alarm Demo
          </Button>
          <Button 
            onClick={() => setShowEmergency(true)} 
            variant="default" 
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 hover-bounce shadow-elegant"
          >
            <HeartPulse className="w-4 h-4 mr-2" /> My Emergency QR
          </Button>
          
          <VoiceInputButton 
            onResult={(text) => {
              const t = text.toLowerCase();
              toast(`Heard: "${text}"`);
              if (t.includes("took") || t.includes("taken")) {
                const next = todaysSchedule.find((s) => !s.logged);
                if (next) logDose(next.med, next.time, "taken");
                else toast("Nothing scheduled to log right now");
              } else if (t.includes("headache") || t.includes("pain") || t.includes("nausea") || t.includes("dizzy") || t.includes("tired")) {
                const sym = ["headache","pain","nausea","dizziness","fatigue"].find(s => t.includes(s.slice(0,4))) || "symptom";
                logSymptom(sym);
              } else if (t.includes("emergency") || t.includes("help") || t.includes("not feeling well")) {
                toast.error("⚠️ Emergency detected. Redirecting to profile...", { duration: 5000 });
                speak("Emergency detected. Opening emergency profile.");
                navigate(`/emergency/${user?.id}`);
              } else {
                toast("Try: 'I took my medicine', 'I have a headache', or 'Emergency'");
              }
            }} 
            placeholder="Voice Assistant"
            className="w-10 h-10"
          />
        </div>
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
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant animate-scale-in ${isOverdue ? "ring-4 ring-destructive/60 animate-pulse-soft" : ""} ${animatingId === `${nextDose.med.id}-${nextDose.time}` ? (animType === "taken" ? "animate-float-up" : "animate-fall-gravity") : ""}`}>
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
            <div className="flex flex-wrap gap-3 mt-5 items-center">
              <Button onClick={() => logDose(nextDose.med, nextDose.time, "taken")} className="bg-card text-foreground hover:bg-card/90 hover-bounce">
                <Check className="w-4 h-4 mr-2" /> Mark as taken
              </Button>
              <Button onClick={() => logDose(nextDose.med, nextDose.time, "missed")} variant="ghost" className="text-primary-foreground hover:bg-white/20">
                Skip
              </Button>
              
              <VoiceInputButton 
                onResult={(text) => {
                  const t = text.toLowerCase();
                  if (t.includes("took") || t.includes("taken") || t.includes("yes") || t.includes("done")) {
                    logDose(nextDose.med, nextDose.time, "taken");
                  } else if (t.includes("skip") || t.includes("no") || t.includes("later")) {
                    logDose(nextDose.med, nextDose.time, "missed");
                  } else {
                    toast("Try: 'I took it' or 'Skip'");
                  }
                }} 
                placeholder="Voice Log"
                className="text-primary-foreground hover:bg-white/20 ml-auto"
              />
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
              {todaysSchedule.map((s, i) => {
                const isAnimating = animatingId === `${s.med.id}-${s.time}`;
                const animClass = isAnimating ? (animType === "taken" ? "animate-float-up" : "animate-fall-gravity") : "";
                
                return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover-glow hover-sheen animate-slide-in ${animClass}`} style={{ animationDelay: isAnimating ? '0s' : `${i * 0.04}s` }}>
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
                      <Button size="sm" variant="ghost" onClick={() => logDose(s.med, s.time, "missed")} className="text-muted-foreground hover:text-destructive">Skip</Button>
                      <Button size="sm" onClick={() => logDose(s.med, s.time, "taken")} className="bg-gradient-primary text-primary-foreground hover-bounce">
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Adherence Chart */}
          <div className="glass-card rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-3">7-Day Adherence</h2>
            <div className="h-40">
              <Bar 
                data={adherenceData} 
                options={{ maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { grid: { display: false } } } }} 
              />
            </div>
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
      </div>

      {/* Quick symptom log & Recent History */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Quick log</h2>
            <VoiceInputButton 
              onResult={(text) => {
                const t = text.toLowerCase();
                const sym = ["headache","nausea","fatigue","dizziness","pain","happy","anxious","calm"].find(s => t.includes(s.toLowerCase())) || text;
                logSymptom(sym);
              }} 
            />
          </div>
          <p className="text-sm text-muted-foreground mb-4">Tap a symptom or mood to log it instantly.</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {["Headache","Nausea","Fatigue","Dizziness","Pain","Happy","Anxious","Calm"].map((s) => (
              <Button key={s} variant="outline" size="sm" onClick={() => logSymptom(s)} className="hover-bounce">{s}</Button>
            ))}
          </div>
          {health.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recently logged</div>
              <div className="space-y-1.5">
                {health.slice(0, 3).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/40">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {["happy","calm"].includes(h.value?.toLowerCase()) ? "😊" :
                         ["anxious"].includes(h.value?.toLowerCase()) ? "😟" :
                         ["headache","pain","nausea","dizziness","fatigue"].some(x => h.value?.toLowerCase().includes(x)) ? "🤒" : "📝"}
                      </span>
                      <span className="font-medium capitalize">{h.value}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {h.created_at ? new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {health.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2 italic">No health logs yet — tap a button above to get started!</p>
          )}
        </div>
        
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Medicine History</h2>
            <Link to="/medications" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {logs.slice(0, 4).map((l, i) => {
              const med = meds.find(m => m.id === l.medication_id);
              return (
                <div key={i} className="flex justify-between items-center text-sm p-2 rounded bg-secondary/30">
                  <div>
                    <span className="font-medium">{med?.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground ml-2">{l.scheduled_time}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${l.status === 'taken' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>
                    {l.status}
                  </span>
                </div>
              );
            })}
            {logs.length === 0 && <p className="text-xs text-muted-foreground py-2">No history recorded yet.</p>}
          </div>
        </div>
      </div>
      
      {/* Alarm Popup */}
      <Dialog open={!!alarmMed} onOpenChange={(o) => { if (!o) setAlarmMed(null); }}>
        <DialogContent className="sm:max-w-md text-center p-8 glass-card border-primary/30 shadow-glow">
          <div className="w-20 h-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-elegant animate-pulse-soft">
            <Bell className="w-10 h-10 text-primary-foreground animate-bounce" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center">Time for {alarmMed?.med.name}</DialogTitle>
            {alarmMed?.med.dosage && (
              <DialogDescription className="text-center text-lg mt-2">
                Dosage: {alarmMed.med.dosage}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-8">
            <Button 
              size="lg" 
              className="w-full bg-gradient-primary text-primary-foreground hover-bounce text-lg h-14 shadow-elegant"
              onClick={() => {
                if (alarmMed?.med.id !== "test") logDose(alarmMed!.med, alarmMed!.time, "taken");
                setAlarmMed(null);
              }}
            >
              <Check className="w-6 h-6 mr-2" /> Mark as Taken
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full hover-bounce h-14 text-muted-foreground border-border/60"
              onClick={() => {
                if (alarmMed?.med.id !== "test") logDose(alarmMed!.med, alarmMed!.time, "missed");
                setAlarmMed(null);
              }}
            >
              Skip Dose
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-primary gap-2"
              onClick={() => {
                document.body.classList.add("animate-vibrate-screen");
                setTimeout(() => document.body.classList.remove("animate-vibrate-screen"), 800);
                playAlarmSound();
                speak(`This is a test. Time to take your ${alarmMed?.med.name || "medication"}.`);
              }}
            >
              🔔 Test Alarm & Vibration
            </Button>

            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-sm text-muted-foreground">Or say "I took it"</span>
              <VoiceInputButton 
                onResult={(text) => {
                  const t = text.toLowerCase();
                  if (t.includes("took") || t.includes("taken") || t.includes("yes") || t.includes("done")) {
                    if (alarmMed?.med.id !== "test") logDose(alarmMed!.med, alarmMed!.time, "taken");
                    setAlarmMed(null);
                  } else if (t.includes("skip") || t.includes("no") || t.includes("later")) {
                    if (alarmMed?.med.id !== "test") logDose(alarmMed!.med, alarmMed!.time, "missed");
                    setAlarmMed(null);
                  }
                }} 
                className="w-12 h-12 bg-primary/5 hover:bg-primary/10"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Emergency Profile Modal */}
      <Dialog open={showEmergency} onOpenChange={setShowEmergency}>
        <DialogContent className="sm:max-w-2xl bg-card border-border shadow-elegant max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <HeartPulse className="w-6 h-6 text-destructive" /> Medical Emergency Profile
            </DialogTitle>
            <DialogDescription>
              This information is publicly accessible when first responders scan your QR code.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-8 mt-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Blood Group</Label>
                  <VoiceInputButton onResult={setEmBlood} placeholder="Speak blood group" />
                </div>
                <Input value={emBlood} onChange={(e) => setEmBlood(e.target.value)} placeholder="e.g. O Positive" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Allergies</Label>
                  <VoiceInputButton onResult={setEmAllergies} placeholder="Speak allergies" />
                </div>
                <Textarea value={emAllergies} onChange={(e) => setEmAllergies(e.target.value)} placeholder="e.g. Penicillin, Peanuts..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Conditions & Diseases</Label>
                  <VoiceInputButton onResult={setEmDiseases} placeholder="Speak conditions" />
                </div>
                <Textarea value={emDiseases} onChange={(e) => setEmDiseases(e.target.value)} placeholder="e.g. Type 2 Diabetes, Hypertension..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label>Emergency Contacts</Label>
                  <VoiceInputButton onResult={setEmContacts} placeholder="Speak emergency contacts" />
                </div>
                <Textarea value={emContacts} onChange={(e) => setEmContacts(e.target.value)} placeholder="e.g. Wife (Jane): +1-555-0192" />
              </div>
              <Button onClick={updateEmergencyProfile} disabled={savingEm} className="w-full bg-gradient-primary hover-bounce">
                {savingEm ? "Saving..." : "Save Emergency Data"}
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-accent-soft/30 rounded-2xl border border-border text-center">
              <div className="bg-white p-4 rounded-xl shadow-md mb-4">
                <QRCodeSVG 
                  value={`${import.meta.env.VITE_PUBLIC_URL || window.location.origin}/emergency/${user?.id}`} 
                  size={200}
                  level="H"
                  fgColor="#000000"
                />
              </div>
              <h3 className="font-bold text-lg text-destructive">Emergency Scan</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Keep this code on your lock screen or in your wallet. First responders can scan it to instantly access your life-saving medical data.
              </p>
              {import.meta.env.VITE_PUBLIC_URL && (
                <p className="text-[10px] text-muted-foreground mt-1 break-all">
                  {`${import.meta.env.VITE_PUBLIC_URL}/emergency/${user?.id}`}
                </p>
              )}
              <Button 
                variant="outline" 
                className="mt-4 w-full"
                onClick={() => {
                  window.open(`/emergency/${user?.id}`, '_blank');
                }}
              >
                Preview Public Page
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
    <div className="glass-card rounded-2xl p-5 hover-tilt hover-sheen animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className={`inline-flex w-10 h-10 rounded-xl bg-gradient-to-br ${styles} items-center justify-center mb-3 shadow-soft`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold">{value}<span className="text-base text-muted-foreground font-normal">{suffix}</span></div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
