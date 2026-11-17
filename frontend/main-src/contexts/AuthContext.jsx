import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
} from "@/services/auth/authApi";
import { resetApiSession, setUnauthenticatedHandler } from "@/services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /* -------------------------------------------------------------- */
  /*  Centralised 401 handler — any apiRequest that receives 401    */
  /*  will trigger this, so a mid-session expiry clears local auth. */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setUser(null);
      setAuthError(null);
    });
    return () => setUnauthenticatedHandler(null);
  }, []);

  /* -------------------------------------------------------------- */
  /*  Re-fetch the authenticated user — exposed for callers that    */
  /*  know a change occurred (e.g. after profile update).           */
  /* -------------------------------------------------------------- */
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

  /* -------------------------------------------------------------- */
  /*  Initial auth check — runs ONCE on mount.                      */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const authenticatedUser = await getCurrentUser();
        if (!active) return;
        setUser(authenticatedUser);
        setAuthError(null);
      } catch (error) {
        if (!active) return;
        if (error.status === 401) {
          setUser(null);
          setAuthError(null);
        } else {
          setAuthError(error);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /* -------------------------------------------------------------- */
  /*  Sign in — populates user directly so no follow-up fetch.      */
  /* -------------------------------------------------------------- */
  const signIn = useCallback(async ({ email, password, remember }) => {
    const result = await loginUser({ email, password, remember });

    if (result?.user) {
      setUser(result.user);
      setAuthError(null);
      return result.user;
    }

    // Fallback if /auth/login doesn't return the user object.
    const authenticatedUser = await getCurrentUser();
    setUser(authenticatedUser);
    setAuthError(null);
    return authenticatedUser;
  }, []);

  /* -------------------------------------------------------------- */
  /*  Sign out — best-effort server logout, always clears locally.  */
  /*  Also clears the CSRF cache so the next session starts fresh.  */
  /* -------------------------------------------------------------- */
  const signOut = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Local sign-out proceeds even if the server call fails.
    } finally {
      resetApiSession();
      setUser(null);
      setAuthError(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      isAuthenticated: Boolean(user),
      refreshUser,
      signIn,
      signOut,
    }),
    [user, loading, authError, refreshUser, signIn, signOut]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }
  return context;
}