import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { generateInsights } from "@/lib/insights";
import { AlertTriangle, Info, Bell } from "lucide-react";

export default function Insights() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    if (!user) return;
    const [logsData, healthData] = await Promise.all([
      apiFetch("/api/medications/logs"),
      apiFetch("/api/health-logs"),
    ]);
    setLogs(logsData || []); setHealth(healthData || []);
  }

  const insights = useMemo(() => generateInsights(logs as any, health as any), [logs, health]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Alerts & Insights</h1>
        <p className="text-muted-foreground mt-1">Smart patterns detected from your data.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {insights.map((i) => {
          const Icon = i.severity === "alert" ? AlertTriangle : i.severity === "warning" ? Bell : Info;
          const styles = i.severity === "alert" ? "bg-destructive/5 border-destructive/30 text-destructive" :
                          i.severity === "warning" ? "bg-warning/5 border-warning/30 text-warning" :
                          "bg-success/5 border-success/30 text-success";
          return (
            <div key={i.id} className={`glass-card rounded-2xl p-6 border-2 ${styles} hover-bounce`}>
              <Icon className="w-8 h-8 mb-3" />
              <div className="font-semibold text-foreground text-lg mb-1">{i.title}</div>
              <div className="text-sm text-muted-foreground">{i.description}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
