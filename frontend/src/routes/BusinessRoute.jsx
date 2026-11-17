import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useBusinessAuth } from "@/contexts/BusinessAuthContext";

export default function BusinessRoute() {
  const { business, loading } = useBusinessAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-semibold text-slate-600">Verifying business access…</p>
      </div>
    );
  }

  return business
    ? <Outlet />
    : <Navigate to="/business/login" replace state={{ from: location }} />;
}
