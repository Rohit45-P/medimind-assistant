import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Users, Trash2, Activity, Pill, AlertTriangle, Siren, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { calculateHealthScore, generateInsights } from "@/lib/insights";
import { showNotification, playAlarmSound } from "@/lib/voice";

interface Patient {
  id: string;
  full_name: string;
  meds: any[];
  logs: any[];
  health: any[];
}

interface EmergencyAlert {
  id: string;
  patient_id: string;
  message: string;
  resolved: boolean;
  created_at: string;
  profiles?: { full_name: string } | null;
}

export default function Caregiver() {
  const { user, profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Emergency alerts state
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlert[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadEmergencyAlerts = useCallback(async () => {
    try {
      const data = await apiFetch("/api/caregiver/emergency-alerts");
      setEmergencyAlerts(data || []);
    } catch {
      setEmergencyAlerts([]);
    }
  }, []);

  useEffect(() => { if (user) { load(); loadEmergencyAlerts(); } }, [user]);

  // Poll for new alerts every 15s as reliable fallback
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(loadEmergencyAlerts, 15000);
    return () => clearInterval(interval);
  }, [user, loadEmergencyAlerts]);

  // ── Real-time subscription to new emergency alerts ──────────────────────
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("caregiver-emergency-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_alerts" },
        (_payload) => {
          loadEmergencyAlerts();
          playAlarmSound();
          showNotification(
            "🚨 Emergency Alert!",
            `A patient needs help! Check the caregiver dashboard immediately.`
          );
          toast.error("🚨 Emergency alert received from a patient!", { duration: 10000 });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadEmergencyAlerts]);

  async function load() {
    if (!user) return;
    try {
      const data = await apiFetch("/api/caregiver/patients");
      setPatients(data || []);
    } catch {
      setPatients([]);
    }
  }

  async function resolveAlert(alertId: string) {
    setResolvingId(alertId);
    try {
      await apiFetch(`/api/caregiver/emergency-alerts/${alertId}/resolve`, { method: "PATCH" });
      toast.success("Alert resolved ✓");
      setEmergencyAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve alert");
    }
    setResolvingId(null);
  }

  async function linkPatient() {
    if (!user) return;
    if (!email.trim()) return toast.error("Email required");
    setLoading(true);
    try {
      await apiFetch("/api/caregiver/link", {
        method: "POST",
        body: JSON.stringify({ patient_email: email.trim().toLowerCase() }),
      });
      toast.success("Patient linked");
      setOpen(false); setEmail(""); load();
    } catch (err: any) {
      toast.error(err.message || "Failed to link patient");
    }
    setLoading(false);
  }

  async function unlink(patientId: string) {
    await apiFetch(`/api/caregiver/unlink/${patientId}`, { method: "DELETE" });
    toast("Patient unlinked"); load();
  }

  // Find the patient name for an alert
  function getPatientName(alert: EmergencyAlert) {
    if ((alert as any).patient_name) return (alert as any).patient_name;
    const patient = patients.find((p) => p.id === alert.patient_id);
    return patient?.full_name || "A patient";
  }

  return (
    <div className="space-y-6">

      {/* ── Emergency Alert Banner ────────────────────────────────────────── */}
      {emergencyAlerts.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/60 bg-gradient-to-r from-red-950/80 via-rose-950/70 to-red-950/80 p-5 shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-pulse-soft">
          {/* Animated glow ring */}
          <div className="absolute inset-0 rounded-2xl ring-2 ring-red-500/40 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="relative flex flex-wrap items-start gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shrink-0 shadow-lg animate-bounce">
                <Siren className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold text-red-300 uppercase tracking-wider">
                  🚨 Emergency Alert{emergencyAlerts.length > 1 ? `s (${emergencyAlerts.length})` : ""}
                </div>
                <div className="text-sm text-red-200/80 mt-0.5">
                  {emergencyAlerts.length === 1
                    ? `${getPatientName(emergencyAlerts[0])} needs help!`
                    : `${emergencyAlerts.length} patients need immediate attention`}
                </div>
              </div>
            </div>
          </div>

          {/* Individual alert cards */}
          <div className="relative mt-4 space-y-3">
            {emergencyAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center gap-3 bg-red-950/60 border border-red-500/30 rounded-xl p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    {getPatientName(alert)}
                  </div>
                  <div className="text-xs text-red-200/70 mt-1">{alert.message}</div>
                  <div className="text-[10px] text-red-300/50 mt-1">
                    {new Date(alert.created_at).toLocaleString([], {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => resolveAlert(alert.id)}
                  disabled={resolvingId === alert.id}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 hover-bounce shrink-0"
                >
                  {resolvingId === alert.id ? (
                    "Resolving…"
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Mark Resolved</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
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

      {/* ── Patients ──────────────────────────────────────────────────────── */}
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
            const patientAlerts = emergencyAlerts.filter((a) => a.patient_id === p.id);
            return (
              <div key={p.id} className={`glass-card rounded-2xl p-6 hover-bounce ${patientAlerts.length > 0 ? "ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]" : ""}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg relative">
                      {p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      {patientAlerts.length > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-background flex items-center justify-center text-[9px] text-white font-bold animate-bounce">
                          {patientAlerts.length}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xl font-bold flex items-center gap-2">
                        {p.full_name}
                        {patientAlerts.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold border border-red-500/30 animate-pulse">
                            🚨 SOS
                          </span>
                        )}
                      </div>
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

                {/* Per-patient emergency alerts */}
                {patientAlerts.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {patientAlerts.map((alert) => (
                      <div key={alert.id} className="flex items-center gap-3 bg-red-950/40 border border-red-500/30 rounded-xl p-3">
                        <Siren className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-red-300">Emergency Alert</div>
                          <div className="text-xs text-red-200/70">{alert.message}</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveAlert(alert.id)}
                          disabled={resolvingId === alert.id}
                          className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover-bounce text-xs shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          {resolvingId === alert.id ? "…" : "Resolve"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

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
