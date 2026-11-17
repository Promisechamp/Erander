import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function AdminRoute() {
  const { loading, isAuthenticated } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
      <LoaderCircle className="mr-3 h-5 w-5 animate-spin text-emerald-600" />
      Checking administrator access…
    </div>;
  }

  return isAuthenticated
    ? <Outlet />
    : <Navigate to="/admin/login" replace state={{ from: location }} />;
}
