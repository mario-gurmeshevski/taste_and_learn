import toast from "react-hot-toast";
import supabase from "../../lib/supabase";
import { sanitizeText } from "../../lib/sanitize";
import { generateDiscriminator } from "../../lib/discriminator";
import type { User } from "../../config/types";
import {
  USER_ROLES as USER_ROLES_CONST,
  DB_TABLES as DB_TABLES_CONST,
  DB_FIELDS as DB_FIELDS_CONST,
} from "../../config/constants";

export async function signInAnonymously(
  userName: string,
  setLoading: (loading: boolean) => void,
  setUser: (user: User | null) => void,
  setUserId: (userId: string | null) => void,
  setIsAuthenticated: (isAuthenticated: boolean) => void,
  setIsAdmin: (isAdmin: boolean) => void,
) {
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

    if (authData.session?.access_token) {
      supabase.realtime.setAuth(authData.session.access_token);
    }

    const discriminator = generateDiscriminator(newUserId);
    const sanitizedName = sanitizeText(userName);

    const { error: insertError } = await supabase
      .from(DB_TABLES_CONST.USERS)
      .upsert({
        id: newUserId,
        name: sanitizedName,
        discriminator: discriminator,
        role: USER_ROLES_CONST.USER,
      });

    if (insertError) {
      throw insertError;
    }

    const newUserData: User = {
      id: newUserId,
      name: sanitizedName,
      discriminator: discriminator,
      role: USER_ROLES_CONST.USER,
      created_at: new Date().toISOString(),
    };

    setUser(newUserData);
    setUserId(newUserId);
    setIsAuthenticated(true);
    setIsAdmin(false);

    const displayName = `${sanitizedName}#${discriminator}`;
    toast.success(`Welcome, ${displayName}!`);

    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (err) {
    const errorMsg = "Error creating account. Please try again.";
    toast.error(errorMsg);
    console.error("Anonymous login error:", err);
    throw err;
  } finally {
    setLoading(false);
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
  setLoading: (loading: boolean) => void,
  setUser: (user: User | null) => void,
  setUserId: (userId: string | null) => void,
  setIsAuthenticated: (isAuthenticated: boolean) => void,
  setIsAdmin: (isAdmin: boolean) => void,
) {
  setLoading(true);

  try {
    await supabase.auth.signOut();

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

    if (authError) {
      if (authError.message.includes("Invalid login credentials")) {
        throw new Error("Invalid email or password.");
      } else if (authError.message.includes("Email not confirmed")) {
        throw new Error(
          "Please confirm your email address before logging in.",
        );
      } else {
        throw new Error(
          "An error occurred during login. Please try again.",
        );
      }
    }

    if (authData.session?.access_token) {
      supabase.realtime.setAuth(authData.session.access_token);
    }

    const { data: userData, error: userError } = await supabase
      .from(DB_TABLES_CONST.USERS)
      .select("*")
      .eq(DB_FIELDS_CONST.ID, authData.user.id)
      .maybeSingle();

    if (userError) {
      throw new Error(
        "Unable to load user profile. Please contact admin.",
      );
    }

    if (!userData) {
      const discriminator = generateDiscriminator(authData.user.id);
      const sanitizedName = sanitizeText(email.split("@")[0]);

      const { error: insertError } = await supabase
        .from(DB_TABLES_CONST.USERS)
        .upsert({
          id: authData.user.id,
          name: sanitizedName,
          discriminator: discriminator,
          role: USER_ROLES_CONST.ADMIN,
        });

      if (insertError) {
        throw new Error("Unable to create user profile.");
      }

      const newUserData: User = {
        id: authData.user.id,
        name: sanitizedName,
        discriminator: discriminator,
        role: USER_ROLES_CONST.ADMIN,
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
      setIsAdmin(userData.role === USER_ROLES_CONST.ADMIN);
    }

    toast.success("Admin login successful!");

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
}

export async function signOut(
  setUser: (user: User | null) => void,
  setUserId: (userId: string | null) => void,
  setIsAuthenticated: (isAuthenticated: boolean) => void,
  setIsAdmin: (isAdmin: boolean) => void,
  setHasValidCachedUser: (hasValidCachedUser: boolean) => void,
  isInitialFetchCompleteRef: React.MutableRefObject<boolean>,
) {
  try {
    await supabase.auth.signOut();

    isInitialFetchCompleteRef.current = false;
    setHasValidCachedUser(false);

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
}

export async function refreshUser(
  userId: string | null,
  fetchUserDataFn: (userId: string) => Promise<User | null>,
  setUser: (user: User | null) => void,
  setIsAdmin: (isAdmin: boolean) => void,
  setHasValidCachedUser: (hasValidCachedUser: boolean) => void,
  isInitialFetchCompleteRef: React.MutableRefObject<boolean>,
) {
  if (!userId) return;

  const userData = await fetchUserDataFn(userId);

  if (userData) {
    setUser({
      ...userData,
      name: sanitizeText(userData.name),
      discriminator: sanitizeText(userData.discriminator),
    });
    setIsAdmin(userData.role === USER_ROLES_CONST.ADMIN);
    setHasValidCachedUser(true);
    isInitialFetchCompleteRef.current = true;
  }
}
