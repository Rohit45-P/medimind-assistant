import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pill, Trash2, Clock, X, History, Check, AlertCircle, Calendar, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Med {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  notes: string;
}
interface MedLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  scheduled_date: string;
  status: string;
  taken_at: string;
}

export default function Medications() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<Med[]>([]);
  const [logs, setLogs] = useState<MedLog[]>([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [notes, setNotes] = useState("");

  // History filters
  const [filterMed, setFilterMed] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<string>("30");

  useEffect(() => { if (user) load(); }, [user]);

  // Realtime: keep history fresh as doses are logged elsewhere
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("meds-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "medication_logs", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "medications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function load() {
    if (!user) return;
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from("medications").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("medication_logs").select("*").eq("user_id", user.id).gte("taken_at", since).order("taken_at", { ascending: false }),
    ]);
    setMeds((m || []) as Med[]);
    setLogs((l || []) as MedLog[]);
  }

  function reset() {
    setName(""); setDosage(""); setTimes(["08:00"]); setNotes("");
  }

  async function save() {
    if (!user) return;
    if (!name.trim()) return toast.error("Medication name is required");
    if (times.length === 0) return toast.error("Add at least one reminder time");
    const { error } = await supabase.from("medications").insert({
      user_id: user.id,
      name: name.trim(),
      dosage: dosage.trim(),
      times,
      notes: notes.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Medication added");
    setOpen(false); reset(); load();
  }

  async function remove(id: string) {
    await supabase.from("medications").update({ active: false }).eq("id", id);
    toast("Medication archived (history kept)");
    load();
  }

  const medMap = useMemo(() => Object.fromEntries(meds.map((m) => [m.id, m])), [meds]);

  const filteredLogs = useMemo(() => {
    const days = parseInt(filterRange, 10);
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return logs.filter((l) => {
      if (new Date(l.taken_at) < since) return false;
      if (filterMed !== "all" && l.medication_id !== filterMed) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      return true;
    });
  }, [logs, filterMed, filterStatus, filterRange]);

  const stats = useMemo(() => {
    const taken = filteredLogs.filter((l) => l.status === "taken").length;
    const missed = filteredLogs.filter((l) => l.status === "missed").length;
    const total = taken + missed;
    return { taken, missed, total, rate: total ? Math.round((taken / total) * 100) : 0 };
  }, [filteredLogs]);

  const perMedStats = useMemo(() => {
    return meds.map((m) => {
      const ml = logs.filter((l) => l.medication_id === m.id);
      const taken = ml.filter((l) => l.status === "taken").length;
      const total = ml.length;
      return { med: m, taken, total, rate: total ? Math.round((taken / total) * 100) : 0, last: ml[0] };
    });
  }, [meds, logs]);

  const activeMeds = meds.filter((m: any) => m.active !== false);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Medications</h1>
          <p className="text-muted-foreground mt-1">Manage your schedule and review your full history.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant">
              <Plus className="w-4 h-4 mr-2" /> Add medication
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New medication</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lisinopril" maxLength={100} />
              </div>
              <div>
                <Label>Dosage</Label>
                <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 10mg, 1 tablet" maxLength={100} />
              </div>
              <div>
                <Label>Reminder times</Label>
                <div className="space-y-2 mt-2">
                  {times.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <Input type="time" value={t} onChange={(e) => {
                        const next = [...times]; next[i] = e.target.value; setTimes(next);
                      }} />
                      {times.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setTimes(times.filter((_, idx) => idx !== i))}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setTimes([...times, "12:00"])} className="hover-bounce">
                    <Plus className="w-4 h-4 mr-1" /> Add time
                  </Button>
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Take with food" maxLength={300} />
              </div>
              <Button onClick={save} className="w-full bg-gradient-primary text-primary-foreground hover-bounce">Save medication</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="active"><Pill className="w-4 h-4 mr-2" />My medications</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />History</TabsTrigger>
        </TabsList>

        {/* ACTIVE TAB */}
        <TabsContent value="active" className="mt-6 animate-fade-up">
          {activeMeds.length === 0 ? (
            <div className="glass-card rounded-3xl p-16 text-center hover-glow">
              <Pill className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-xl font-semibold mb-2">No medications yet</h2>
              <p className="text-muted-foreground mb-6">Add your first medication to start receiving reminders.</p>
              <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant">
                <Plus className="w-4 h-4 mr-2" /> Add medication
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {perMedStats.filter(({ med }: any) => (med as any).active !== false).map(({ med: m, taken, total, rate, last }, i) => (
                <div
                  key={m.id}
                  className="glass-card rounded-2xl p-5 hover-tilt hover-sheen group animate-fade-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
                        <Pill className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{m.name}</div>
                        {m.dosage && <div className="text-sm text-muted-foreground">{m.dosage}</div>}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {m.times.map((t) => (
                      <span key={t} className="text-xs bg-secondary px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t}
                      </span>
                    ))}
                  </div>

                  {m.notes && <p className="text-sm text-muted-foreground mt-3 italic">💡 {m.notes}</p>}

                  {/* Mini adherence bar */}
                  {total > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/60">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Adherence</span>
                        <span className="font-semibold">{rate}% · {taken}/{total}</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-primary transition-all duration-700"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      {last && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Last logged: {new Date(last.taken_at).toLocaleDateString()} ({last.status})
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="mt-6 animate-fade-up space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-xl p-4 hover-glow">
              <div className="text-2xl font-bold text-success">{stats.taken}</div>
              <div className="text-xs text-muted-foreground">Doses taken</div>
            </div>
            <div className="glass-card rounded-xl p-4 hover-glow">
              <div className="text-2xl font-bold text-destructive">{stats.missed}</div>
              <div className="text-xs text-muted-foreground">Doses missed</div>
            </div>
            <div className="glass-card rounded-xl p-4 hover-glow">
              <div className="text-2xl font-bold gradient-text">{stats.rate}%</div>
              <div className="text-xs text-muted-foreground">Adherence rate</div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card rounded-2xl p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <Label className="text-xs">Medication</Label>
              <Select value={filterMed} onValueChange={setFilterMed}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All medications</SelectItem>
                  {meds.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="taken">Taken</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <Label className="text-xs">Period</Label>
              <Select value={filterRange} onValueChange={setFilterRange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Log list */}
          <div className="glass-card rounded-2xl p-2">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">No history matches these filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredLogs.map((l, i) => {
                  const m = medMap[l.medication_id];
                  const taken = l.status === "taken";
                  return (
                    <div
                      key={l.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/40 transition-colors animate-slide-in"
                      style={{ animationDelay: `${Math.min(i * 0.02, 0.4)}s` }}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${taken ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                        {taken ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{m?.name || "Unknown medication"}</div>
                        <div className="text-xs text-muted-foreground">
                          Scheduled {l.scheduled_date} at {l.scheduled_time}
                          {m?.dosage && ` · ${m.dosage}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${taken ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          {l.status}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(l.taken_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
