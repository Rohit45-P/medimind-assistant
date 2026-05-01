import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, User, Users, Mail, Phone, ShieldCheck, Sparkles, Heart } from "lucide-react";
import Logo from "@/components/Logo";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().trim().email("Invalid email").max(255);
const passwordSchema = z.string().min(6, "Min 6 characters").max(72);
const nameSchema = z.string().trim().min(1, "Required").max(100);
const phoneSchema = z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Use international format e.g. +14155552671");

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [siEmail, setSiEmail] = useState("");
  const [siPwd, setSiPwd] = useState("");

  const [suEmail, setSuEmail] = useState("");
  const [suPwd, setSuPwd] = useState("");
  const [suName, setSuName] = useState("");
  const [suRole, setSuRole] = useState<"patient" | "caregiver">("patient");

  // Phone OTP
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [phoneName, setPhoneName] = useState("");

  async function handleGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message || "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    toast.success("Signed in with Google");
    navigate("/dashboard");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    try {
      emailSchema.parse(siEmail);
      passwordSchema.parse(siPwd);
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await signIn(siEmail, siPwd);
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("Invalid") ? "Incorrect email or password" : error.message);
    } else {
      toast.success("Welcome back!");
      navigate("/dashboard");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    try {
      nameSchema.parse(suName);
      emailSchema.parse(suEmail);
      passwordSchema.parse(suPwd);
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    const { error } = await signUp(suEmail, suPwd, suName, suRole);
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("registered") ? "Email already registered" : error.message);
    } else {
      toast.success("Account created!");
      navigate(suRole === "caregiver" ? "/caregiver" : "/dashboard");
    }
  }

  async function sendOtp() {
    try { phoneSchema.parse(phone); } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? "Invalid phone");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { data: { full_name: phoneName || "", role: "patient" } },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Could not send code");
    } else {
      setOtpSent(true);
      toast.success("Verification code sent");
    }
  }

  async function verifyOtp() {
    if (otp.length < 4) { toast.error("Enter the code"); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setLoading(false);
    if (error) toast.error(error.message || "Invalid code");
    else { toast.success("Signed in!"); navigate("/dashboard"); }
  }

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-10 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-10 -right-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left: Brand panel (desktop) */}
        <div className="hidden lg:flex flex-col gap-6 p-8 animate-fade-up">
          <Link to="/" className="hover-bounce inline-block w-fit">
            <Logo size={64} textClassName="text-3xl" animated />
          </Link>
          <h1 className="text-4xl xl:text-5xl font-extrabold leading-tight">
            Your <span className="gradient-text">digital memory</span><br />for better health.
          </h1>
          <p className="text-muted-foreground text-lg">
            Smart reminders, voice logging, and caregiver support — all in one calm, beautiful app.
          </p>
          <div className="space-y-3 pt-2">
            {[
              { icon: ShieldCheck, text: "Bank-grade encryption & privacy" },
              { icon: Sparkles, text: "AI-powered health insights" },
              { icon: Heart, text: "Loved by patients & caregivers" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 animate-slide-in" style={{ animationDelay: `${0.2 + i * 0.1}s` }}>
                <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft shrink-0">
                  <f.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Auth card */}
        <div className="w-full max-w-md mx-auto animate-scale-in">
          <Link to="/" className="lg:hidden flex items-center justify-center mb-6">
            <Logo size={48} textClassName="text-2xl" animated />
          </Link>

        <div className="glass-card rounded-3xl p-6 md:p-8 shadow-elegant">
          <Button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            variant="outline"
            className="w-full h-11 mb-4 hover-bounce gap-2 font-medium"
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">Or</span>
            </div>
          </div>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-6">
              <TabsTrigger value="signin"><Mail className="w-3.5 h-3.5 mr-1" />Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create</TabsTrigger>
              <TabsTrigger value="phone"><Phone className="w-3.5 h-3.5 mr-1" />Phone</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="animate-fade-up">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" autoComplete="email" value={siEmail} onChange={(e) => setSiEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div>
                  <Label htmlFor="si-pwd">Password</Label>
                  <Input id="si-pwd" type="password" autoComplete="current-password" value={siPwd} onChange={(e) => setSiPwd(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant h-11">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="animate-fade-up">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="su-name">Full name</Label>
                  <Input id="su-name" value={suName} onChange={(e) => setSuName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" autoComplete="email" value={suEmail} onChange={(e) => setSuEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div>
                  <Label htmlFor="su-pwd">Password</Label>
                  <Input id="su-pwd" type="password" autoComplete="new-password" value={suPwd} onChange={(e) => setSuPwd(e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div>
                  <Label className="mb-2 block">I am a…</Label>
                  <RadioGroup value={suRole} onValueChange={(v) => setSuRole(v as any)} className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all hover-bounce ${suRole === "patient" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="patient" className="sr-only" />
                      <User className="w-4 h-4" /> <span className="text-sm font-medium">Patient</span>
                    </label>
                    <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all hover-bounce ${suRole === "caregiver" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <RadioGroupItem value="caregiver" className="sr-only" />
                      <Users className="w-4 h-4" /> <span className="text-sm font-medium">Caregiver</span>
                    </label>
                  </RadioGroup>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant h-11">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="phone" className="animate-fade-up">
              {!otpSent ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="ph-name">Full name (optional)</Label>
                    <Input id="ph-name" value={phoneName} onChange={(e) => setPhoneName(e.target.value)} placeholder="Jane Doe" />
                  </div>
                  <div>
                    <Label htmlFor="ph">Mobile number</Label>
                    <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+14155552671" />
                    <p className="text-xs text-muted-foreground mt-1">Include country code (e.g. +1, +44, +91)</p>
                  </div>
                  <Button onClick={sendOtp} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant h-11">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send verification code"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">SMS provider must be configured in Cloud → Auth → Phone.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="otp">6-digit code sent to {phone}</Label>
                    <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="123456" maxLength={6} className="text-center text-lg tracking-widest" />
                  </div>
                  <Button onClick={verifyOtp} disabled={loading} className="w-full bg-gradient-primary text-primary-foreground hover-bounce shadow-elegant h-11">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & sign in"}
                  </Button>
                  <Button variant="ghost" onClick={() => { setOtpSent(false); setOtp(""); }} className="w-full">Use a different number</Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
