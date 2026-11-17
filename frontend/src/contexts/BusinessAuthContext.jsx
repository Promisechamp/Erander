import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as businessAuthApi from "@/services/business/businessAuthApi";

const BusinessAuthContext = createContext(null);

export function BusinessAuthProvider({ children }) {
  const [business, setBusiness] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshBusiness = useCallback(async () => {
    try {
      const response = await businessAuthApi.getCurrentBusiness();
      const data = response?.data ?? {};
      setBusiness(data.business ?? null);
      setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
      setUser(data.user ?? null);
      return data.business ?? null;
    } catch (error) {
      setBusiness(null);
      setBusinesses([]);
      setUser(null);
      if (error?.status !== 401 && error?.status !== 403) throw error;
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    businessAuthApi.getCurrentBusiness()
      .then((response) => {
        if (!active) return;
        const data = response?.data ?? {};
        setBusiness(data.business ?? null);
        setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
        setUser(data.user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setBusiness(null);
        setBusinesses([]);
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (credentials) => {
    try {
      const response = await businessAuthApi.loginBusiness(credentials);
      const data = response?.data ?? {};
      setBusiness(data.business ?? null);
      setBusinesses(Array.isArray(data.businesses) ? data.businesses : []);
      setUser(data.user ?? null);
      return data.business ?? null;
    } catch (error) {
      if (error?.status === 409 && Array.isArray(error?.data?.businesses)) {
        setBusinesses(error.data.businesses);
      }
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await businessAuthApi.logoutBusiness();
    } finally {
      setBusiness(null);
      setBusinesses([]);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({
    business,
    businesses,
    user,
    loading,
    isAuthenticated: Boolean(business),
    refreshBusiness,
    signIn,
    signOut,
  }), [business, businesses, user, loading, refreshBusiness, signIn, signOut]);

  return (
    <BusinessAuthContext.Provider value={value}>
      {children}
    </BusinessAuthContext.Provider>
  );
}

export function useBusinessAuth() {
  const context = useContext(BusinessAuthContext);
  if (!context) {
    throw new Error("useBusinessAuth must be used inside a BusinessAuthProvider.");
  }
  return context;
}
