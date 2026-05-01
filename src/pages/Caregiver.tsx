import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Trash2, Activity, Pill, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { calculateHealthScore, generateInsights } from "@/lib/insights";

interface Patient {
  id: string;
  full_name: string;
  meds: any[];
  logs: any[];
  health: any[];
}

export default function Caregiver() {
  const { user, profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    if (!user) return;
    const { data: links } = await supabase.from("caregiver_links").select("patient_id").eq("caregiver_id", user.id);
    const ids = (links || []).map((l: any) => l.patient_id);
    if (ids.length === 0) { setPatients([]); return; }

    const [{ data: profs }, { data: meds }, { data: logs }, { data: health }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", ids),
      supabase.from("medications").select("*").in("user_id", ids),
      supabase.from("medication_logs").select("*").in("user_id", ids),
      supabase.from("health_logs").select("*").in("user_id", ids),
    ]);

    const list: Patient[] = (profs || []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name || "Patient",
      meds: (meds || []).filter((m: any) => m.user_id === p.id),
      logs: (logs || []).filter((l: any) => l.user_id === p.id),
      health: (health || []).filter((h: any) => h.user_id === p.id),
    }));
    setPatients(list);
  }

  async function linkPatient() {
    if (!user) return;
    if (!email.trim()) return toast.error("Email required");
    setLoading(true);
    const { data: pid, error } = await supabase.rpc("find_user_id_by_email", { _email: email.trim().toLowerCase() });
    if (error || !pid) {
      setLoading(false);
      return toast.error("No patient found with that email");
    }
    if (pid === user.id) {
      setLoading(false);
      return toast.error("That's your own account");
    }
    const { error: linkErr } = await supabase.from("caregiver_links").insert({ caregiver_id: user.id, patient_id: pid });
    setLoading(false);
    if (linkErr) return toast.error(linkErr.code === "23505" ? "Already linked" : linkErr.message);
    toast.success("Patient linked");
    setOpen(false); setEmail(""); load();
  }

  async function unlink(patientId: string) {
    if (!user) return;
    await supabase.from("caregiver_links").delete().eq("caregiver_id", user.id).eq("patient_id", patientId);
    toast("Patient unlinked"); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Caregiver Dashboard</h1>
          <p className="text-muted-foreground mt-1">Hello {profile?.full_name?.split(" ")[0]}, here are the patients you support.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant">
              <Plus className="w-4 h-4 mr-2" /> Link a patient
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Link a patient by email</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the email the patient signed up with. They must already have a MediRecall account.</p>
              <div>
                <Label>Patient email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patient@example.com" />
              </div>
              <Button onClick={linkPatient} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover-bounce">
                {loading ? "Linking…" : "Link patient"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {patients.length === 0 ? (
        <div className="glass-card rounded-3xl p-16 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold mb-2">No patients linked yet</h2>
          <p className="text-muted-foreground mb-6">Link a patient to monitor their medication adherence and alerts.</p>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant">
            <Plus className="w-4 h-4 mr-2" /> Link a patient
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {patients.map((p) => {
            const score = calculateHealthScore(p.logs as any);
            const insights = generateInsights(p.logs as any, p.health as any);
            const today = new Date().toISOString().slice(0, 10);
            const todayLogs = p.logs.filter((l: any) => l.scheduled_date === today);
            const missedToday = todayLogs.filter((l: any) => l.status === "missed").length;
            return (
              <div key={p.id} className="glass-card rounded-2xl p-6 hover-bounce">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                      {p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xl font-bold">{p.full_name}</div>
                      <div className="text-sm text-muted-foreground">{p.meds.length} active medication{p.meds.length !== 1 && "s"}</div>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => unlink(p.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <Activity className="w-4 h-4 mx-auto mb-1 text-success" />
                    <div className="text-2xl font-bold">{score}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Health score</div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <Pill className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <div className="text-2xl font-bold">{todayLogs.filter((l: any) => l.status === "taken").length}/{todayLogs.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Today's doses</div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <AlertTriangle className={`w-4 h-4 mx-auto mb-1 ${missedToday > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                    <div className={`text-2xl font-bold ${missedToday > 0 ? "text-destructive" : ""}`}>{missedToday}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Missed today</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {insights.slice(0, 2).map((i) => (
                    <div key={i.id} className={`text-sm p-3 rounded-xl border-l-4 ${
                      i.severity === "alert" ? "bg-destructive/5 border-destructive" :
                      i.severity === "warning" ? "bg-warning/5 border-warning" :
                      "bg-success/5 border-success"
                    }`}>
                      <div className="font-medium">{i.title}</div>
                      <div className="text-xs text-muted-foreground">{i.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
