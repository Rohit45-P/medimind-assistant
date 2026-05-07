import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HeartPulse, Droplet, AlertTriangle, Phone, Stethoscope, Pill, Loader2, Info } from "lucide-react";
import Logo from "@/components/Logo";

interface EmergencyProfile {
  id: string;
  full_name: string;
  blood_group: string | null;
  allergies: string | null;
  emergency_contacts: string | null;
  diseases: string | null;
}

interface Med {
  id: string;
  name: string;
  dosage: string;
}

export default function Emergency() {
  const { id } = useParams();
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [meds, setMeds] = useState<Med[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEmergencyData() {
      if (!id) return;
      try {
        // Fetch profile
        const { data: profData, error: profError } = await supabase
          .from("profiles")
          .select("id, full_name, blood_group, allergies, emergency_contacts, diseases")
          .eq("id", id)
          .single();

        if (profError) throw new Error("Could not find emergency profile.");
        setProfile(profData as EmergencyProfile);

        // Fetch active medications
        const { data: medData, error: medError } = await supabase
          .from("medications")
          .select("id, name, dosage")
          .eq("user_id", id)
          .eq("active", true);

        if (!medError && medData) {
          setMeds(medData);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load patient data.");
      } finally {
        setLoading(false);
      }
    }

    fetchEmergencyData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 mesh-bg text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm mt-4 opacity-70">
          Ensure the QR code is correct or the patient has enabled emergency access.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-red-50/30 dark:bg-red-950/10">
      {/* Red emergency banner */}
      <div className="bg-destructive text-destructive-foreground p-4 flex items-center justify-center gap-2 shadow-md">
        <AlertTriangle className="w-5 h-5 animate-pulse" />
        <span className="font-bold tracking-widest uppercase text-sm md:text-base">Emergency Medical Profile</span>
      </div>

      <div className="container max-w-2xl py-8 space-y-6">
        {/* Header card */}
        <div className="bg-card rounded-3xl p-6 md:p-8 shadow-elegant border border-destructive/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-bl-[100px]" />
          <Logo size={48} animated />
          <h1 className="text-3xl md:text-4xl font-extrabold mt-6 mb-2">{profile.full_name || "Unknown Patient"}</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <Info className="w-4 h-4" /> Verified Medical Data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Blood Group */}
          <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-soft border border-border flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Droplet className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Blood Group</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {profile.blood_group || "Unknown"}
              </div>
            </div>
          </div>

          {/* Allergies */}
          <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-soft border border-border flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Allergies</div>
              <div className="font-semibold text-orange-700 dark:text-orange-400 leading-tight">
                {profile.allergies || "None reported"}
              </div>
            </div>
          </div>
        </div>

        {/* Diseases & Conditions */}
        <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-soft border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Stethoscope className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Existing Conditions & Diseases</h2>
          </div>
          <p className="text-foreground/90 font-medium whitespace-pre-wrap">
            {profile.diseases || "No specific conditions reported."}
          </p>
        </div>

        {/* Emergency Contacts */}
        <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-soft border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Phone className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold">Emergency Contacts</h2>
          </div>
          <p className="text-foreground/90 font-medium whitespace-pre-wrap">
            {profile.emergency_contacts || "No emergency contacts listed."}
          </p>
        </div>

        {/* Current Medications */}
        <div className="bg-white dark:bg-card p-6 rounded-2xl shadow-soft border border-border">
          <div className="flex items-center gap-3 mb-4">
            <Pill className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold">Current Active Medications</h2>
          </div>
          {meds.length > 0 ? (
            <div className="space-y-3">
              {meds.map((m) => (
                <div key={m.id} className="flex justify-between items-center p-3 rounded-xl bg-accent-soft/30 border border-accent/10">
                  <span className="font-semibold">{m.name}</span>
                  <span className="text-sm text-muted-foreground">{m.dosage}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground italic">No active medications logged.</p>
          )}
        </div>
      </div>
    </div>
  );
}
