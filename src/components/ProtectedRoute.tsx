import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

export default function ProtectedRoute({ children, role }: { children: ReactNode; role?: "patient" | "caregiver" }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-gradient-primary animate-pulse-soft" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (role && profile && profile.role !== role) {
    return <Navigate to={profile.role === "caregiver" ? "/caregiver" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
