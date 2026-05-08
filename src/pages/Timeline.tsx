import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

export default function Timeline() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    if (!user) return;
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [logsData, healthData] = await Promise.all([
      apiFetch(`/api/medications/logs?since=${since}`),
      apiFetch(`/api/health-logs?since=${since}&limit=200`),
    ]);
    setLogs(logsData || []); setHealth(healthData || []);
  }

  const days = useMemo(() => {
    const arr: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  const adherenceData = useMemo(() => {
    const taken = days.map((d) => logs.filter((l) => l.scheduled_date === d && l.status === "taken").length);
    const missed = days.map((d) => logs.filter((l) => l.scheduled_date === d && l.status === "missed").length);
    return {
      labels: days.map((d) => d.slice(5)),
      datasets: [
        { label: "Taken", data: taken, backgroundColor: "hsl(174 62% 42%)", borderRadius: 8 },
        { label: "Missed", data: missed, backgroundColor: "hsl(0 78% 60%)", borderRadius: 8 },
      ],
    };
  }, [days, logs]);

  const symptomData = useMemo(() => {
    const counts = days.map((d) => health.filter((h) => h.created_at.slice(0, 10) === d && h.type === "symptom").length);
    return {
      labels: days.map((d) => d.slice(5)),
      datasets: [{
        label: "Symptoms reported",
        data: counts,
        borderColor: "hsl(12 88% 65%)",
        backgroundColor: "hsl(12 88% 65% / 0.15)",
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointBackgroundColor: "hsl(12 88% 65%)",
        pointRadius: 4,
      }],
    };
  }, [days, health]);

  const chartOpts = {
    responsive: true,
    plugins: { legend: { position: "bottom" as const } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  const recentSymptoms = health.filter((h) => h.type === "symptom").slice(-12).reverse();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold">Health Timeline</h1>
        <p className="text-muted-foreground mt-1">Your last 14 days at a glance.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Medication adherence</h2>
          <Bar data={adherenceData} options={chartOpts} />
        </div>
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-semibold mb-4">Symptoms over time</h2>
          <Line data={symptomData} options={chartOpts} />
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Recent symptom log</h2>
        {recentSymptoms.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No symptoms logged yet.</p>
        ) : (
          <div className="space-y-2">
            {recentSymptoms.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <span className="font-medium capitalize">{s.value}</span>
                <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
