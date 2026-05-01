import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HeartPulse, Pill, Bell, Brain, Users, Mic, Activity, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const features = [
  { icon: Pill, title: "Smart Medication Tracking", desc: "Never miss a dose. Daily schedule with one-tap log." },
  { icon: Bell, title: "Voice & Browser Reminders", desc: "Speech-synthesised reminders the moment it matters." },
  { icon: Brain, title: "Pattern Detection", desc: "We spot missed-dose trends and recurring symptoms before you do." },
  { icon: Mic, title: "Talk to Track", desc: "Say 'I took my medicine' or 'I have a headache' — we log it." },
  { icon: Users, title: "Caregiver Dashboard", desc: "Family members see adherence in real time." },
  { icon: Activity, title: "Doctor-Ready Reports", desc: "Export a clean PDF summary for your next appointment." },
];

export default function Landing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      navigate(profile.role === "caregiver" ? "/caregiver" : "/dashboard", { replace: true });
    }
  }, [user, profile, navigate]);

  return (
    <div className="min-h-screen mesh-bg">
      {/* Nav */}
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <HeartPulse className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl gradient-text">MediRecall</span>
        </div>
        <Link to="/auth"><Button variant="outline" className="hover-bounce">Sign in</Button></Link>
      </header>

      {/* Hero */}
      <section className="container py-16 md:py-28 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-soft text-accent border border-accent/20 text-sm font-medium mb-6 animate-scale-in">
          <Sparkles className="w-4 h-4" /> Your digital memory for health
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-up">
          Never forget a <span className="gradient-text">dose</span> again.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          MediRecall is a smart memory assistant that tracks medications, detects health patterns,
          and keeps caregivers informed — all in one calm, beautiful place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <Link to="/auth"><Button size="lg" className="bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant text-base h-12 px-8">Get started — it's free</Button></Link>
          <a href="#features"><Button size="lg" variant="outline" className="hover-bounce h-12 px-8">See how it works</Button></a>
        </div>

        {/* Floating preview card */}
        <div className="mt-20 max-w-4xl mx-auto relative animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <div className="absolute -inset-4 bg-gradient-hero opacity-20 blur-3xl rounded-3xl" />
          <div className="relative glass-card rounded-3xl p-8 shadow-elegant">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="p-5 rounded-2xl bg-gradient-primary text-primary-foreground animate-float">
                <Pill className="w-8 h-8 mb-3" />
                <div className="text-sm opacity-90">Next dose</div>
                <div className="text-2xl font-bold">Lisinopril</div>
                <div className="text-sm opacity-90">in 12 minutes</div>
              </div>
              <div className="p-5 rounded-2xl bg-card border border-border animate-float" style={{ animationDelay: "0.5s" }}>
                <Activity className="w-8 h-8 mb-3 text-success" />
                <div className="text-sm text-muted-foreground">Health Score</div>
                <div className="text-2xl font-bold">94<span className="text-base text-muted-foreground">/100</span></div>
                <div className="text-sm text-success">+6 this week</div>
              </div>
              <div className="p-5 rounded-2xl bg-accent-soft border border-accent/20 animate-float" style={{ animationDelay: "1s" }}>
                <Brain className="w-8 h-8 mb-3 text-accent" />
                <div className="text-sm text-accent">Insight</div>
                <div className="font-semibold mt-1">Evening doses logged consistently — great work!</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Built like medicine should be</h2>
        <p className="text-center text-muted-foreground mb-12">Calm, intelligent, and quietly powerful.</p>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={f.title} className="glass-card rounded-2xl p-6 hover-bounce animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-soft">
                <f.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="container py-12 text-center text-sm text-muted-foreground border-t border-border/60 mt-12">
        © 2026 MediRecall — A digital memory assistant for patients & families.
      </footer>
    </div>
  );
}
