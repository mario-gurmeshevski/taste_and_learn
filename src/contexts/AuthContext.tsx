/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import toast from "react-hot-toast";
import supabase from "../lib/supabase";
import { sanitizeText } from "../lib/sanitize";
import { generateDiscriminator } from "../lib/discriminator";
import type { User } from "../config/types";
import {
  DB_TABLES,
  USER_ROLES,
  DB_FIELDS,
} from "../config/constants";

/**
 * Authentication context state
 */
interface AuthState {
  user: User | null;
  userId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  checkingAuth: boolean;
}

/**
 * Authentication context actions
 */
interface AuthActions {
  signInAnonymously: (userName: string) => Promise<void>;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Combined authentication context
 */
type AuthContextType = AuthState & AuthActions;

// Create context with undefined default value
const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

/**
 * AuthProvider component - manages all authentication state and logic
 */
export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  /**
   * Fetch user data from database with retry logic
   */
  const fetchUserData = useCallback(
    async (
      userId: string,
      retries: number = 3,
    ): Promise<User | null> => {
      for (let i = 0; i < retries; i++) {
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        const { data, error } = await supabase
          .from(DB_TABLES.USERS)
          .select("*")
          .eq(DB_FIELDS.ID, userId)
          .maybeSingle();

        if (data) {
          return data;
        }

        if (error && !error.message.includes("FetchError")) {
          console.error("Error fetching user data:", error);
          break;
        }
      }

      return null;
    },
    [],
  );

  /**
   * Update authentication state based on session
   */
  const updateAuthState = useCallback(
    async (
      session: {
        user?: { id: string };
        access_token?: string;
      } | null,
      event?: string,
    ) => {
      if (!session || !session.user) {
        setUser(null);
        setUserId(null);
        setIsAuthenticated(false);
        setIsAdmin(false);
        setCheckingAuth(false);
        return;
      }

      const currentUserId = session.user.id;
      setUserId(currentUserId);
      setIsAuthenticated(true);

      // Set realtime auth token
      if (session.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      // Skip fetch on SIGNED_IN (too early), wait for INITIAL_SESSION or TOKEN_REFRESHED
      if (event === "SIGNED_IN") {
        setCheckingAuth(false);
        return;
      }

      // Wait a bit for initialization on INITIAL_SESSION
      if (event === "INITIAL_SESSION") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Fetch user data with retries
      const userData = await fetchUserData(currentUserId);

      if (userData) {
        setUser({
          ...userData,
          name: sanitizeText(userData.name),
          discriminator: sanitizeText(userData.discriminator),
        });
        setIsAdmin(userData.role === USER_ROLES.ADMIN);
      } else {
        // Set default user role if no data found
        setUser({
          id: currentUserId,
          name: "Unknown",
          discriminator: "0000",
          role: USER_ROLES.USER,
          created_at: new Date().toISOString(),
        });
        setIsAdmin(false);
      }

      setCheckingAuth(false);
    },
    [fetchUserData],
  );

  /**
   * Initialize auth state listener
   */
  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      await updateAuthState(session, event);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [updateAuthState]);

  /**
   * Sign in anonymously with user name
   */
  const signInAnonymously = useCallback(async (userName: string) => {
    if (!userName.trim()) {
      throw new Error("User name is required");
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInAnonymously();

      if (authError) throw authError;

      if (!authData.user?.id) {
        throw new Error("No user ID returned from anonymous sign-in");
      }

      const newUserId = authData.user.id;

      // Set realtime auth token
      if (authData.session?.access_token) {
        supabase.realtime.setAuth(authData.session.access_token);
      }

      const discriminator = generateDiscriminator(newUserId);
      const sanitizedName = sanitizeText(userName);

      // Create or update user in database
      const { error: insertError } = await supabase
        .from(DB_TABLES.USERS)
        .upsert({
          id: newUserId,
          name: sanitizedName,
          discriminator: discriminator,
          role: USER_ROLES.USER,
        });

      if (insertError) {
        throw insertError;
      }

      // Update local state
      const newUserData: User = {
        id: newUserId,
        name: sanitizedName,
        discriminator: discriminator,
        role: USER_ROLES.USER,
        created_at: new Date().toISOString(),
      };

      setUser(newUserData);
      setUserId(newUserId);
      setIsAuthenticated(true);
      setIsAdmin(false);

      const displayName = `${sanitizedName}#${discriminator}`;
      toast.success(`Welcome, ${displayName}!`);

      // Small delay for state to settle
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      const errorMsg = "Error creating account. Please try again.";
      toast.error(errorMsg);
      console.error("Anonymous login error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Sign in with email and password (admin login)
   */
  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setLoading(true);

      try {
        // Sign out any existing session
        await supabase.auth.signOut();

        const { data: authData, error: authError } =
          await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });

        if (authError) {
          // Handle specific error messages
          if (
            authError.message.includes("Invalid login credentials")
          ) {
            throw new Error("Invalid email or password.");
          } else if (
            authError.message.includes("Email not confirmed")
          ) {
            throw new Error(
              "Please confirm your email address before logging in.",
            );
          } else {
            throw new Error(
              "An error occurred during login. Please try again.",
            );
          }
        }

        // Set realtime auth token
        if (authData.session?.access_token) {
          supabase.realtime.setAuth(authData.session.access_token);
        }

        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from(DB_TABLES.USERS)
          .select("*")
          .eq(DB_FIELDS.ID, authData.user.id)
          .maybeSingle();

        if (userError) {
          throw new Error(
            "Unable to load user profile. Please contact admin.",
          );
        }

        if (!userData) {
          // Create user profile if it doesn't exist
          const discriminator = generateDiscriminator(
            authData.user.id,
          );
          const sanitizedName = sanitizeText(email.split("@")[0]);

          const { error: insertError } = await supabase
            .from(DB_TABLES.USERS)
            .upsert({
              id: authData.user.id,
              name: sanitizedName,
              discriminator: discriminator,
              role: USER_ROLES.ADMIN,
            });

          if (insertError) {
            throw new Error("Unable to create user profile.");
          }

          const newUserData: User = {
            id: authData.user.id,
            name: sanitizedName,
            discriminator: discriminator,
            role: USER_ROLES.ADMIN,
            created_at: new Date().toISOString(),
          };

          setUser(newUserData);
          setUserId(authData.user.id);
          setIsAuthenticated(true);
          setIsAdmin(true);
        } else {
          setUser({
            ...userData,
            name: sanitizeText(userData.name),
            discriminator: sanitizeText(userData.discriminator),
          });
          setUserId(authData.user.id);
          setIsAuthenticated(true);
          setIsAdmin(userData.role === USER_ROLES.ADMIN);
        }

        toast.success("Admin login successful!");

        // Small delay for state to settle
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.";
        toast.error(errorMsg);
        console.error("Login error:", err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * Sign out current user
   */
  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserId(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      toast.success("Logged out successfully", { icon: "👋" });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
      throw error;
    }
  }, []);

  /**
   * Refresh user data from database
   */
  const refreshUser = useCallback(async () => {
    if (!userId) return;

    const userData = await fetchUserData(userId);

    if (userData) {
      setUser({
        ...userData,
        name: sanitizeText(userData.name),
        discriminator: sanitizeText(userData.discriminator),
      });
      setIsAdmin(userData.role === USER_ROLES.ADMIN);
    }
  }, [userId, fetchUserData]);

  /**
   * Context value
   */
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userId,
      isAuthenticated,
      isAdmin,
      loading,
      checkingAuth,
      signInAnonymously,
      signInWithPassword,
      signOut,
      refreshUser,
    }),
    [
      user,
      userId,
      isAuthenticated,
      isAdmin,
      loading,
      checkingAuth,
      signInAnonymously,
      signInWithPassword,
      signOut,
      refreshUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access authentication context
 * Throws error if used outside AuthProvider
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Hook to access current user data
 */
export const useUser = (): User | null => {
  const { user } = useAuth();
  return user;
};

/**
 * Hook to require authentication - throws error if not authenticated
 */
export const useRequireAuth = (): {
  user: User;
  userId: string;
  isAdmin: boolean;
} => {
  const { user, userId, isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated || !user || !userId) {
    throw new Error("User must be authenticated");
  }

  return { user, userId, isAdmin };
};

/**
 * Hook to require admin role - throws error if not admin
 */
export const useRequireAdmin = (): {
  user: User;
  userId: string;
} => {
  const { user, userId, isAdmin } = useAuth();

  if (!isAdmin || !user || !userId) {
    throw new Error("User must be an admin");
  }

  return { user, userId };
};

export default AuthContext;
