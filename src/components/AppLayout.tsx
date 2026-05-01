import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Pill, Activity, Bell, Users, FileText, LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState, ReactNode } from "react";
import Logo from "@/components/Logo";

const patientNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/medications", label: "Medications", icon: Pill },
  { to: "/timeline", label: "Health Timeline", icon: Activity },
  { to: "/insights", label: "Insights", icon: Bell },
  { to: "/summary", label: "Doctor Summary", icon: FileText },
];
const caregiverNav = [
  { to: "/caregiver", label: "Patients", icon: Users },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const nav = profile?.role === "caregiver" ? caregiverNav : patientNav;

  return (
    <div className="min-h-screen mesh-bg">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 min-h-screen flex-col border-r border-border/60 bg-card/50 backdrop-blur-xl px-4 py-6 sticky top-0">
          <div className="px-2 mb-8">
            <Logo size={40} textClassName="text-lg" />
            <div className="text-xs text-muted-foreground capitalize mt-1 ml-[52px] -mt-1">{profile?.role}</div>
          </div>

          <nav className="flex-1 space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover-bounce ${
                    isActive
                      ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="space-y-2 pt-4 border-t border-border/60">
            <div className="px-3 py-2 text-sm">
              <div className="font-medium truncate">{profile?.full_name || "User"}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} className="hover-bounce">
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 hover-bounce" onClick={async () => { await signOut(); navigate("/auth"); }}>
                <LogOut className="w-4 h-4 mr-2" />Sign out
              </Button>
            </div>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/60 px-4 py-3 flex items-center justify-between">
          <Logo size={32} textClassName="text-base" />
          <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        {/* Main */}
        <main className="flex-1 md:py-8 py-20 px-4 md:px-10 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto animate-fade-up">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-xl border-t border-border/60 grid grid-cols-5 px-1 py-2">
          {nav.slice(0, 5).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 rounded-lg text-[10px] ${isActive ? "text-primary" : "text-muted-foreground"}`
            }>
              <item.icon className="w-5 h-5" />
              {item.label.split(" ")[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
