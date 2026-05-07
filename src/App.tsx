import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Medications from "./pages/Medications";
import Timeline from "./pages/Timeline";
import Insights from "./pages/Insights";
import Summary from "./pages/Summary";
import Caregiver from "./pages/Caregiver";
import Emergency from "./pages/Emergency";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();

function ThemeBoot() {
  useEffect(() => {
    if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark");
  }, []);
  return null;
}

function RoleRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/auth" replace />;
  return <Navigate to={profile.role === "caregiver" ? "/caregiver" : "/dashboard"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeBoot />
      <Toaster />
      <Sonner position="top-right" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<RoleRedirect />} />
            <Route path="/emergency/:id" element={<Emergency />} />

            <Route path="/dashboard" element={<ProtectedRoute role="patient"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/medications" element={<ProtectedRoute role="patient"><AppLayout><Medications /></AppLayout></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute role="patient"><AppLayout><Timeline /></AppLayout></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute role="patient"><AppLayout><Insights /></AppLayout></ProtectedRoute>} />
            <Route path="/summary" element={<ProtectedRoute role="patient"><AppLayout><Summary /></AppLayout></ProtectedRoute>} />

            <Route path="/caregiver" element={<ProtectedRoute role="caregiver"><AppLayout><Caregiver /></AppLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
