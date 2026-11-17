import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as adminAuthApi from "@/services/admin/adminAuthApi";

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAdmin = useCallback(async () => {
    try {
      const response = await adminAuthApi.getCurrentAdmin();
      const current = response?.data?.admin || null;
      setAdmin(current);
      return current;
    } catch {
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshAdmin(); }, [refreshAdmin]);

  const signIn = useCallback(async (credentials) => {
    const response = await adminAuthApi.adminLogin(credentials);
    const current = response?.data?.admin || null;
    setAdmin(current);
    return current;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await adminAuthApi.adminLogout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = useMemo(() => ({
    admin, loading, isAuthenticated: Boolean(admin), signIn, signOut, refreshAdmin,
  }), [admin, loading, signIn, signOut, refreshAdmin]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  return context;
}