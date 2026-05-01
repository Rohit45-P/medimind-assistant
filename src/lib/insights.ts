// Pattern detection & insights
export interface MedLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  scheduled_date: string;
  status: string;
  taken_at: string;
}
export interface HealthLog {
  id: string;
  type: string;
  value: string;
  intensity?: number | null;
  created_at: string;
}
export interface Insight {
  id: string;
  severity: "info" | "warning" | "alert";
  title: string;
  description: string;
}

function timeOfDay(t: string): "morning" | "afternoon" | "evening" | "night" {
  const h = parseInt(t.split(":")[0] || "0", 10);
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

export function generateInsights(logs: MedLog[], health: HealthLog[]): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const recent = logs.filter((l) => new Date(l.taken_at) >= weekAgo);
  const missed = recent.filter((l) => l.status === "missed");

  if (missed.length >= 3) {
    insights.push({
      id: "missed-week",
      severity: "warning",
      title: `${missed.length} missed doses this week`,
      description: "Consider adjusting your reminder times or asking your caregiver for support.",
    });
  }

  // Missed by time-of-day
  const buckets: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  missed.forEach((l) => { buckets[timeOfDay(l.scheduled_time)]++; });
  const worst = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 2) {
    insights.push({
      id: "missed-tod",
      severity: "alert",
      title: `You frequently miss ${worst[0]} doses`,
      description: `${worst[1]} missed ${worst[0]} doses recently. Try setting an extra reminder 15 minutes earlier.`,
    });
  }

  // Recurring symptoms
  const symptomCounts: Record<string, number> = {};
  health
    .filter((h) => h.type === "symptom" && new Date(h.created_at) >= weekAgo)
    .forEach((h) => { symptomCounts[h.value.toLowerCase()] = (symptomCounts[h.value.toLowerCase()] || 0) + 1; });

  Object.entries(symptomCounts).forEach(([sym, count]) => {
    if (count >= 3) {
      insights.push({
        id: `sym-${sym}`,
        severity: "alert",
        title: `Recurring: ${sym}`,
        description: `You reported ${sym} ${count} times this week. Consider consulting a doctor.`,
      });
    }
  });

  if (insights.length === 0) {
    insights.push({
      id: "all-good",
      severity: "info",
      title: "You're doing great! 🌿",
      description: "No concerning patterns detected. Keep up the consistent habits.",
    });
  }

  return insights;
}

export function calculateHealthScore(logs: MedLog[]): number {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recent = logs.filter((l) => new Date(l.taken_at) >= weekAgo);
  if (recent.length === 0) return 100;
  const taken = recent.filter((l) => l.status === "taken").length;
  return Math.round((taken / recent.length) * 100);
}
