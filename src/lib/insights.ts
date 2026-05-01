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
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);

  const recent = logs.filter((l) => new Date(l.taken_at) >= weekAgo);
  const missed = recent.filter((l) => l.status === "missed");
  const taken = recent.filter((l) => l.status === "taken");

  // 1. Critical: multiple missed doses today
  const missedToday = missed.filter((l) => new Date(l.taken_at) >= dayAgo);
  if (missedToday.length >= 2) {
    insights.push({
      id: "missed-today",
      severity: "alert",
      title: `${missedToday.length} doses missed today`,
      description: "Please check in with your caregiver and take your next dose on time.",
    });
  }

  // 2. Streak detection (positive reinforcement)
  const sortedDays = Array.from(new Set(recent.map((l) => l.scheduled_date))).sort().reverse();
  let streak = 0;
  for (const d of sortedDays) {
    const dayLogs = recent.filter((l) => l.scheduled_date === d);
    if (dayLogs.length > 0 && dayLogs.every((l) => l.status === "taken")) streak++;
    else break;
  }
  if (streak >= 3) {
    insights.push({
      id: "streak",
      severity: "info",
      title: `🔥 ${streak}-day perfect streak!`,
      description: "You've taken every scheduled dose. Keep the momentum going!",
    });
  }

  // 3. Weekly miss pattern
  if (missed.length >= 3) {
    insights.push({
      id: "missed-week",
      severity: "warning",
      title: `${missed.length} missed doses this week`,
      description: "Consider adjusting your reminder times or asking your caregiver for support.",
    });
  }

  // 4. Time-of-day pattern (smarter: % rate, not count)
  const buckets: Record<string, { missed: number; total: number }> = {
    morning: { missed: 0, total: 0 }, afternoon: { missed: 0, total: 0 },
    evening: { missed: 0, total: 0 }, night: { missed: 0, total: 0 },
  };
  recent.forEach((l) => {
    const tod = timeOfDay(l.scheduled_time);
    buckets[tod].total++;
    if (l.status === "missed") buckets[tod].missed++;
  });
  const worstTod = Object.entries(buckets)
    .filter(([, b]) => b.total >= 3)
    .map(([k, b]) => ({ k, rate: b.missed / b.total, missed: b.missed }))
    .sort((a, b) => b.rate - a.rate)[0];
  if (worstTod && worstTod.rate >= 0.4) {
    insights.push({
      id: "missed-tod",
      severity: "alert",
      title: `${worstTod.k.charAt(0).toUpperCase()+worstTod.k.slice(1)} doses are at risk`,
      description: `${Math.round(worstTod.rate*100)}% of ${worstTod.k} doses missed. Try an earlier reminder or pair the dose with a daily routine.`,
    });
  }

  // 5. Recurring symptoms with intensity awareness
  const symptomCounts: Record<string, number> = {};
  const intensitySum: Record<string, number> = {};
  health
    .filter((h) => h.type === "symptom" && new Date(h.created_at) >= weekAgo)
    .forEach((h) => {
      const k = h.value.toLowerCase();
      symptomCounts[k] = (symptomCounts[k] || 0) + 1;
      intensitySum[k] = (intensitySum[k] || 0) + (h.intensity || 0);
    });

  Object.entries(symptomCounts).forEach(([sym, count]) => {
    if (count >= 3) {
      const avg = intensitySum[sym] / count;
      insights.push({
        id: `sym-${sym}`,
        severity: avg >= 6 ? "alert" : "warning",
        title: `Recurring: ${sym} (${count}×)`,
        description: `Reported ${count} times this week${avg ? ` with avg intensity ${avg.toFixed(1)}/10` : ""}. Consider consulting your doctor.`,
      });
    }
  });

  // 6. Symptom-medication correlation
  if (missed.length >= 2 && Object.keys(symptomCounts).length >= 1) {
    const topSym = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0];
    if (topSym && topSym[1] >= 2) {
      insights.push({
        id: "correlation",
        severity: "warning",
        title: "Possible correlation detected",
        description: `${topSym[0]} reports increased alongside missed doses. Adherence may be affecting symptoms.`,
      });
    }
  }

  // 7. Adherence trend
  if (recent.length >= 5) {
    const rate = taken.length / recent.length;
    if (rate >= 0.95) {
      insights.push({
        id: "excellent",
        severity: "info",
        title: "Excellent adherence 🌟",
        description: `${Math.round(rate*100)}% adherence this week. Your future self thanks you!`,
      });
    } else if (rate < 0.5) {
      insights.push({
        id: "low-adherence",
        severity: "alert",
        title: "Adherence needs attention",
        description: `Only ${Math.round(rate*100)}% of doses taken. Talk to your caregiver about adjusting your routine.`,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-good",
      severity: "info",
      title: "You're doing great! 🌿",
      description: "No concerning patterns detected. Keep up the consistent habits.",
    });
  }

  // Sort by severity
  const order = { alert: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function calculateHealthScore(logs: MedLog[]): number {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recent = logs.filter((l) => new Date(l.taken_at) >= weekAgo);
  if (recent.length === 0) return 100;
  const taken = recent.filter((l) => l.status === "taken").length;
  return Math.round((taken / recent.length) * 100);
}
