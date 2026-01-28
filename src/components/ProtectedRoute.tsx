import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FaSpinner } from "react-icons/fa";
import supabase from "../lib/supabase";
import type { ProtectedRouteProps, BasicUser } from "../config/types";
import { DB_TABLES, USER_ROLES, DB_FIELDS } from "../config/constants";
import type { Session } from "@supabase/supabase-js";

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<BasicUser | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Add timeout to prevent infinite loading on mobile
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timeout")), 5000)
        );

        const sessionPromise = supabase.auth.getSession();

        const result = await Promise.race([
          sessionPromise,
          timeoutPromise,
        ]) as { data: { session: Session | null } };

        const session = result.data.session;

        if (!session) {
          setHasSession(false);
          setLoading(false);
          return;
        }

        setHasSession(true);

        const isAnonUser = session.user.is_anonymous || false;

        if (!isAnonUser) {
          const { data: userData, error } = await supabase
            .from(DB_TABLES.USERS)
            .select("*")
            .eq(DB_FIELDS.ID, session.user.id)
            .maybeSingle();

          if (error) {
            console.error("Error fetching user:", error);
            setUser({ role: USER_ROLES.USER });
          } else if (userData) {
            setUser(userData);
          } else {
            setUser({ role: USER_ROLES.USER });
          }
        } else {
          setUser({ role: USER_ROLES.USER });
        }

        setLoading(false);
      } catch (error) {
        // Fail gracefully - treat as no session
        console.error("Auth check failed:", error);
        setHasSession(false);
        setUser(null);
        setLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setHasSession(true);
        const isAnonUser = session.user.is_anonymous || false;

        if (!isAnonUser) {
          const { data: userData, error } = await supabase
            .from(DB_TABLES.USERS)
            .select("*")
            .eq(DB_FIELDS.ID, session.user.id)
            .maybeSingle();

          if (error) {
            console.error("Error fetching user:", error);
            setUser({ role: USER_ROLES.USER });
          } else if (userData) {
            setUser(userData);
          } else {
            setUser({ role: USER_ROLES.USER });
          }
        }
      } else {
        setUser(null);
        setHasSession(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 animate-spin mx-auto text-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if no session exists
  if (!hasSession || !user) {
    // Store the attempted path for redirect after login
    localStorage.setItem("redirectPath", location.pathname);
    return <Navigate to="/login" replace />;
  }

  // Check admin requirement
  if (requireAdmin && user.role !== USER_ROLES.ADMIN) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
