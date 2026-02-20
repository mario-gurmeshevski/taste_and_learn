import toast from "react-hot-toast";
import supabase from "../../lib/supabase";
import { sanitizeText } from "../../lib/sanitize";
import type { User } from "../../config/types";
import {
  DB_TABLES,
  USER_ROLES,
  DB_FIELDS,
  DEBUG_MODE,
} from "../../config/constants";

export function clearAuthTimeout(
  timeoutRef: React.MutableRefObject<number | null>,
) {
  if (timeoutRef.current !== null) {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

export async function fetchUserData(
  userId: string,
  maxRetries: number = 3,
  initialDelay: number = 1000,
): Promise<User | null> {
  if (DEBUG_MODE) {
    console.log(
      "[AUTH:FETCH] Fetching user data for userId:",
      userId,
      `maxRetries: ${maxRetries}`,
    );
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = initialDelay * Math.pow(2, attempt - 1);
      if (DEBUG_MODE) {
        console.log(
          `[AUTH:FETCH] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const { data, error } = await supabase
        .from(DB_TABLES.USERS)
        .select("*")
        .eq(DB_FIELDS.ID, userId)
        .maybeSingle();

      if (data) {
        if (DEBUG_MODE) {
          console.log(
            `[AUTH:FETCH] Successfully fetched user data on attempt ${attempt + 1}`,
          );
        }
        return data;
      }

      if (!data && !error) {
        if (DEBUG_MODE) {
          console.log("[AUTH:FETCH] User not found (no data returned)");
        }
        return null;
      }

      if (error) {
        if (error.message.includes("PGRST116")) {
          if (DEBUG_MODE) {
            console.log(
              "[AUTH:FETCH] User not found in database (PGRST116)",
            );
          }
          return null;
        }
        if (
          error.message.includes("FetchError") ||
          error.message.includes("network") ||
          error.message.includes("timeout")
        ) {
          if (DEBUG_MODE) {
            console.warn(
              `[AUTH:FETCH] Network error on attempt ${attempt + 1}:`,
              error.message,
            );
          }
          continue;
        }
        if (DEBUG_MODE) {
          console.error(
            "[AUTH:FETCH] Fatal error fetching user data:",
            error,
          );
        }
        return null;
      }
    } catch (err) {
      if (DEBUG_MODE) {
        console.error(
          `[AUTH:FETCH] Exception on attempt ${attempt + 1}:`,
          err,
        );
      }
      if (attempt === maxRetries - 1) {
        console.error(
          "[AUTH:FETCH] All retries exhausted for user data fetch",
          { userId, error: err },
        );
      }
    }
  }

  if (DEBUG_MODE) {
    console.error("[AUTH:FETCH] Failed to fetch user data after all retries");
  }
  return null;
}

export async function updateAuthState(
  session: {
    user?: { id: string };
    access_token?: string;
  } | null,
  event: string | undefined,
  fetchUserDataFn: (userId: string) => Promise<User | null>,
  isUpdatingAuthRef: React.MutableRefObject<boolean>,
  isInitialFetchCompleteRef: React.MutableRefObject<boolean>,
  setUser: (user: User | null) => void,
  setUserId: (userId: string | null) => void,
  setIsAuthenticated: (isAuthenticated: boolean) => void,
  setIsAdmin: (isAdmin: boolean) => void,
  setHasValidCachedUser: (hasValidCachedUser: boolean) => void,
  setCheckingAuth: (checkingAuth: boolean) => void,
  clearAuthTimeoutFn: () => void,
) {
  if (isUpdatingAuthRef.current) {
    if (DEBUG_MODE) {
      console.log(
        "[AUTH:UPDATE] Skipping - another update in progress",
        { event },
      );
    }
    return;
  }

  isUpdatingAuthRef.current = true;

  try {
    if (!session || !session.user) {
      isInitialFetchCompleteRef.current = false;
      setHasValidCachedUser(false);

      setUser(null);
      setUserId(null);
      setIsAuthenticated(false);
      setIsAdmin(false);
      clearAuthTimeoutFn();
      setCheckingAuth(false);
      return;
    }

    const currentUserId = session.user.id;
    setUserId(currentUserId);
    setIsAuthenticated(true);

    if (session.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }

    if (event === "SIGNED_IN") {
      if (DEBUG_MODE) {
        console.log(
          "[AUTH:UPDATE] SIGNED_IN - fetching user data for new session",
        );
      }

      const userData = await fetchUserDataFn(currentUserId);

      if (userData) {
        setUser({
          ...userData,
          name: sanitizeText(userData.name),
          discriminator: sanitizeText(userData.discriminator),
        });
        setIsAdmin(userData.role === USER_ROLES.ADMIN);
        setHasValidCachedUser(true);
        isInitialFetchCompleteRef.current = true;

        if (DEBUG_MODE) {
          console.log(
            "[AUTH:UPDATE] User data fetched and cached for new session",
          );
        }
      } else {
        if (DEBUG_MODE) {
          console.log("[AUTH:UPDATE] Account not found during sign in");
        }
        toast.error(
          "Account not found. Please try logging in again.",
          { icon: "👋", duration: 5000 },
        );
        setUser(null);
        setUserId(null);
        setIsAuthenticated(false);
        setIsAdmin(false);
      }

      clearAuthTimeoutFn();
      setCheckingAuth(false);
      return;
    }

    if (event === "INITIAL_SESSION") {
      if (isInitialFetchCompleteRef.current) {
        if (DEBUG_MODE) {
          console.log(
            "[AUTH:UPDATE] INITIAL_SESSION - using cached user data",
          );
        }
        clearAuthTimeoutFn();
        setCheckingAuth(false);
        return;
      }

      if (DEBUG_MODE) {
        console.log(
          "[AUTH:UPDATE] INITIAL_SESSION - first fetch, caching user data",
        );
      }

      const userData = await fetchUserDataFn(currentUserId);

      if (userData) {
        setUser({
          ...userData,
          name: sanitizeText(userData.name),
          discriminator: sanitizeText(userData.discriminator),
        });
        setIsAdmin(userData.role === USER_ROLES.ADMIN);
        setHasValidCachedUser(true);
        isInitialFetchCompleteRef.current = true;

        if (DEBUG_MODE) {
          console.log(
            "[AUTH:UPDATE] User data fetched and cached for initial session",
          );
        }
      } else {
        if (DEBUG_MODE) {
          console.log(
            "[AUTH:UPDATE] Account deleted on INITIAL_SESSION, signing out",
          );
        }

        toast.error(
          "Account no longer exists. Please log in again.",
          { icon: "👋", duration: 5000 },
        );

        setHasValidCachedUser(false);
        isInitialFetchCompleteRef.current = false;
        setUser(null);
        setUserId(null);
        setIsAuthenticated(false);
        setIsAdmin(false);
        setCheckingAuth(false);

        supabase.auth.signOut().catch((signOutError) => {
          console.error("[AUTH:SIGNOUT] Failed to sign out:", signOutError);
        });

        setTimeout(() => {
          window.location.href = "/login";
        }, 300);

        return;
      }

      clearAuthTimeoutFn();
      setCheckingAuth(false);
      return;
    }

    if (event === "TOKEN_REFRESHED") {
      if (DEBUG_MODE) {
        console.log(
          "[AUTH:UPDATE] TOKEN_REFRESHED - using cached user data",
        );
      }
      clearAuthTimeoutFn();
      setCheckingAuth(false);
      return;
    }

    if (DEBUG_MODE) {
      console.log("[AUTH:UPDATE] Unexpected auth event:", event);
    }
    clearAuthTimeoutFn();
    setCheckingAuth(false);
  } catch (error) {
    console.error("[AUTH:UPDATE] Error updating auth state:", error);
    setCheckingAuth(false);
    toast.error(
      "Failed to authenticate. Please try refreshing the page.",
      {
        icon: "❌",
        duration: 5000,
      },
    );
  } finally {
    isUpdatingAuthRef.current = false;
  }
}
