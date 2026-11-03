import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute() {
  const { user, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#E8FBF0] border-t-[#20CC88]" />

          <p className="mt-4 text-sm font-semibold text-[#14213D]">
            Verifying your session...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Please wait while we securely load your account.
          </p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-[#14213D]">
            Unable to verify your session
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            We couldn't contact the authentication service.
            Please check your connection and try again.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-[#14213D] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#203658]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return <Outlet />;
}