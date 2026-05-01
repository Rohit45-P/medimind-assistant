import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { HeartPulse, Loader2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().trim().email("Invalid email").max(255);
const passwordSchema = z.string().min(6, "Min 6 characters").max(72);
const nameSchema = z.string().trim().min(1, "Required").max(100);

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

  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <HeartPulse className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl gradient-text">MediRecall</span>
        </Link>

        <div className="glass-card rounded-3xl p-6 md:p-8 shadow-elegant">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
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

            <TabsContent value="signup">
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
          </Tabs>
        </div>
      </div>
    </div>
  );
}
