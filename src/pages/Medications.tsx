import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pill, Trash2, Clock, X } from "lucide-react";
import { toast } from "sonner";

interface Med {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  notes: string;
}

export default function Medications() {
  const { user } = useAuth();
  const [meds, setMeds] = useState<Med[]>([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [notes, setNotes] = useState("");

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("medications").select("*").eq("user_id", user.id).order("created_at");
    setMeds((data || []) as Med[]);
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
    await supabase.from("medications").delete().eq("id", id);
    toast("Medication removed");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold">Medications</h1>
          <p className="text-muted-foreground mt-1">Manage your medication schedule.</p>
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

      {meds.length === 0 ? (
        <div className="glass-card rounded-3xl p-16 text-center">
          <Pill className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" />
          <h2 className="text-xl font-semibold mb-2">No medications yet</h2>
          <p className="text-muted-foreground mb-6">Add your first medication to start receiving reminders.</p>
          <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant">
            <Plus className="w-4 h-4 mr-2" /> Add medication
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {meds.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-5 hover-bounce group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                    <Pill className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">{m.name}</div>
                    {m.dosage && <div className="text-sm text-muted-foreground">{m.dosage}</div>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive">
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
              {m.notes && <p className="text-sm text-muted-foreground mt-3 italic">{m.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
