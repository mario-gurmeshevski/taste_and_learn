import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import toast from "react-hot-toast";
import supabase from "../../lib/supabase";
import type { User } from "../../config/types";
import {
  AUTH_TIMEOUT,
  DEBUG_MODE,
} from "../../config/constants";
import type { AuthContextType } from "../../config/types";
import { clearAuthTimeout, fetchUserData, updateAuthState } from "./state";
import {
  signInAnonymously,
  signInWithPassword,
  signOut,
  refreshUser,
} from "./actions";

const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export { AuthContext };

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasValidCachedUser, setHasValidCachedUser] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const initializedRef = useRef(false);
  const checkingAuthRef = useRef(true);
  const isUpdatingAuthRef = useRef(false);
  const isInitialFetchCompleteRef = useRef(false);

  const handleClearAuthTimeout = useCallback(() => {
    clearAuthTimeout(timeoutRef);
  }, []);

  const handleFetchUserData = useCallback(
    async (uid: string) => fetchUserData(uid),
    [],
  );

  const handleUpdateAuthState = useCallback(
    async (session: { user?: { id: string }; access_token?: string } | null, event: string) => {
      await updateAuthState(
        session,
        event,
        handleFetchUserData,
        isUpdatingAuthRef,
        isInitialFetchCompleteRef,
        setUser,
        setUserId,
        setIsAuthenticated,
        setIsAdmin,
        setHasValidCachedUser,
        setCheckingAuth,
        handleClearAuthTimeout,
      );
    },
    [handleFetchUserData, handleClearAuthTimeout],
  );

  useEffect(() => {
    checkingAuthRef.current = checkingAuth;
  }, [checkingAuth]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      await handleUpdateAuthState(session, event);
    });

    timeoutRef.current = window.setTimeout(() => {
      if (mounted && checkingAuthRef.current) {
        if (DEBUG_MODE) {
          console.log(
            "[AUTH:TIMEOUT] Auth check timeout - forcing checkingAuth to false",
          );
        }
        setCheckingAuth(false);
        toast.error(
          "Connection taking longer than expected. Please try logging in.",
          { icon: "⏱️", duration: 5000 },
        );
      }
    }, AUTH_TIMEOUT);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [handleUpdateAuthState]);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (checkingAuth && DEBUG_MODE) {
        console.warn(
          "[AUTH:SAFETY] checkingAuth still true after auth setup - forcing to false",
        );
        setCheckingAuth(false);
      }
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, [checkingAuth]);

  const handleSignInAnonymously = useCallback(
    async (userName: string) => {
      await signInAnonymously(
        userName,
        setLoading,
        setUser,
        setUserId,
        setIsAuthenticated,
        setIsAdmin,
      );
    },
    [],
  );

  const handleSignInWithPassword = useCallback(
    async (email: string, password: string) => {
      await signInWithPassword(
        email,
        password,
        setLoading,
        setUser,
        setUserId,
        setIsAuthenticated,
        setIsAdmin,
      );
    },
    [],
  );

  const handleSignOut = useCallback(async () => {
    await signOut(
      setUser,
      setUserId,
      setIsAuthenticated,
      setIsAdmin,
      setHasValidCachedUser,
      isInitialFetchCompleteRef,
    );
  }, [setHasValidCachedUser]);

  const handleRefreshUser = useCallback(async () => {
    await refreshUser(
      userId,
      handleFetchUserData,
      setUser,
      setIsAdmin,
      setHasValidCachedUser,
      isInitialFetchCompleteRef,
    );
  }, [userId, handleFetchUserData, setHasValidCachedUser]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userId,
      isAuthenticated,
      isAdmin,
      loading,
      checkingAuth,
      hasValidCachedUser,
      signInAnonymously: handleSignInAnonymously,
      signInWithPassword: handleSignInWithPassword,
      signOut: handleSignOut,
      refreshUser: handleRefreshUser,
    }),
    [
      user,
      userId,
      isAuthenticated,
      isAdmin,
      loading,
      checkingAuth,
      hasValidCachedUser,
      handleSignInAnonymously,
      handleSignInWithPassword,
      handleSignOut,
      handleRefreshUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
