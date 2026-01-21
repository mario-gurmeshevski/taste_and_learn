import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FaSpinner } from "react-icons/fa";
import supabase from "../lib/supabase";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setHasSession(false);
        setLoading(false);
        return;
      }

      setHasSession(true);

      const isAnonUser = session.user.is_anonymous || false;

      if (!isAnonUser) {
        const { data: userData, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user:", error);
          setUser({ role: "user" });
        } else if (userData) {
          setUser(userData);
        } else {
          setUser({ role: "user" });
        }
      } else {
        setUser({ role: "user" });
      }

      setLoading(false);
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
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (error) {
            console.error("Error fetching user:", error);
            setUser({ role: "user" });
          } else if (userData) {
            setUser(userData);
          } else {
            setUser({ role: "user" });
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
  if (requireAdmin && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
