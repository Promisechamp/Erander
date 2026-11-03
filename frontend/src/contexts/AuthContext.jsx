import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { getCurrentUser, logoutUser } from "@/services/auth/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const location = useLocation();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const authenticatedUser = await getCurrentUser();

      setUser(authenticatedUser);
      setAuthError(null);

      return authenticatedUser;
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        setAuthError(null);
        return null;
      }

      setAuthError(error);
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initializeAuthentication() {
      setLoading(true);

      try {
        const authenticatedUser = await getCurrentUser();

        if (active) {
          setUser(authenticatedUser);
          setAuthError(null);
        }
      } catch (error) {
        if (!active) return;

        if (error.status === 401) {
          setUser(null);
          setAuthError(null);
        } else {
          setAuthError(error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initializeAuthentication();

    return () => {
      active = false;
    };
  }, [location.pathname]);

  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      // Clear the local authenticated state even if the request fails.
      setUser(null);
      setAuthError(null);
    }
  }, []);

  const value = {
    user,
    loading,
    authError,
    isAuthenticated: Boolean(user),
    refreshUser,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider."
    );
  }

  return context;
}