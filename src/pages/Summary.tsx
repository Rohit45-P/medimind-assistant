import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calculateHealthScore } from "@/lib/insights";
import { toast } from "sonner";

export default function Summary() {
  const { user, profile } = useAuth();
  const [meds, setMeds] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    if (!user) return;
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const [medsData, logsData, healthData] = await Promise.all([
      apiFetch("/api/medications"),
      apiFetch(`/api/medications/logs?since=${since}`),
      apiFetch(`/api/health-logs?since=${since}&limit=200`),
    ]);
    setMeds(medsData || []); setLogs(logsData || []); setHealth(healthData || []);
  }

  const taken = logs.filter((l) => l.status === "taken").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const score = calculateHealthScore(logs as any);

  function exportPDF() {
    const doc = new jsPDF();
    doc.setFontSize(20); doc.text("MediRecall — Doctor Summary", 14, 20);
    doc.setFontSize(11); doc.setTextColor(120);
    doc.text(`Patient: ${profile?.full_name || "—"}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);
    doc.text(`Period: Last 30 days`, 14, 42);

    doc.setTextColor(0); doc.setFontSize(13);
    doc.text("Adherence overview", 14, 54);
    doc.setFontSize(11);
    doc.text(`Health score: ${score}/100   |   Doses taken: ${taken}   |   Missed: ${missed}`, 14, 62);

    autoTable(doc, {
      startY: 72,
      head: [["Medication", "Dosage", "Reminder times"]],
      body: meds.map((m) => [m.name, m.dosage || "—", (m.times || []).join(", ")]),
      headStyles: { fillColor: [42, 157, 143] },
    });

    const symRows = health.filter((h) => h.type === "symptom").slice(-30).map((h) => [
      new Date(h.created_at).toLocaleDateString(), h.value, h.note || "",
    ]);
    if (symRows.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Date", "Symptom", "Note"]],
        body: symRows,
        headStyles: { fillColor: [231, 111, 81] },
      });
    }

    const missedRows = logs.filter((l) => l.status === "missed").slice(-30).map((l) => {
      const med = meds.find((m) => m.id === l.medication_id);
      return [l.scheduled_date, l.scheduled_time, med?.name || "—"];
    });
    if (missedRows.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["Date", "Time", "Missed medication"]],
        body: missedRows,
        headStyles: { fillColor: [200, 60, 60] },
      });
    }

    doc.save(`MediRecall-Summary-${new Date().toISOString().slice(0,10)}.pdf`);
    toast.success("PDF downloaded");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Doctor Summary</h1>
          <p className="text-muted-foreground mt-1">A 30-day report you can share with your physician.</p>
        </div>
        <Button onClick={exportPDF} className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant">
          <Download className="w-4 h-4 mr-2" /> Export as PDF
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6 hover-bounce">
          <div className="text-sm text-muted-foreground mb-1">Health score</div>
          <div className="text-4xl font-bold gradient-text">{score}<span className="text-xl text-muted-foreground">/100</span></div>
        </div>
        <div className="glass-card rounded-2xl p-6 hover-bounce">
          <div className="text-sm text-muted-foreground mb-1">Doses taken</div>
          <div className="text-4xl font-bold text-success">{taken}</div>
        </div>
        <div className="glass-card rounded-2xl p-6 hover-bounce">
          <div className="text-sm text-muted-foreground mb-1">Doses missed</div>
          <div className="text-4xl font-bold text-destructive">{missed}</div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2"><FileText className="w-5 h-5" /> Active medications</h2>
        {meds.length === 0 ? (
          <p className="text-muted-foreground text-sm">No medications recorded.</p>
        ) : (
          <div className="space-y-2">
            {meds.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/40">
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.dosage || "—"}</div>
                </div>
                <div className="text-sm text-muted-foreground">{(m.times || []).join(", ")}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
