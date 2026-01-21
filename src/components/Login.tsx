import React, { useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaSpinner } from "react-icons/fa";
import supabase from "../lib/supabase";

const Login: React.FC = () => {
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsAuthenticated(true);
      }
      setCheckingAuth(false);
    };

    checkAuth();
  }, []);

  // Redirect if already authenticated
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 animate-spin mx-auto text-neutral-900" />
          <p className="mt-4 text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleAnonymousLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInAnonymously();
      if (authError) throw authError;

      const newUserId = authData.user?.id!;

      if (authData.session?.access_token) {
        supabase.realtime.setAuth(authData.session.access_token);
      }

      const { error: insertError } = await supabase
        .from("users")
        .upsert({ id: newUserId, name: userName, role: "user" });

      if (insertError) throw insertError;

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if there's a saved redirect path
      const redirectPath = localStorage.getItem("redirectPath");
      if (redirectPath && redirectPath !== "/login") {
        localStorage.removeItem("redirectPath");
        navigate(redirectPath);
      } else {
        navigate("/quiz");
      }
    } catch (err) {
      setError("Error creating account. Please try again.");
      console.error("Anonymous login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await supabase.auth.signOut();

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError("Invalid email or password.");
        } else if (
          authError.message.includes("Email not confirmed")
        ) {
          setError(
            "Please confirm your email address before logging in.",
          );
        } else {
          setError(
            "An error occurred during login. Please try again.",
          );
        }

        const { data: anonData } =
          await supabase.auth.signInAnonymously();
        if (anonData.session?.access_token) {
          supabase.realtime.setAuth(anonData.session.access_token);
        }
        return;
      }

      if (authData.session?.access_token) {
        supabase.realtime.setAuth(authData.session.access_token);
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (userError) {
        setError(
          "Unable to load user profile. Please contact admin.",
        );
        return;
      }

      if (!userData) {
        const { error: insertError } = await supabase
          .from("users")
          .upsert({
            id: authData.user.id,
            name: email.split("@")[0],
            role: "user",
          });

        if (insertError) {
          setError("Unable to create user profile.");
          return;
        }

        // Check if there's a saved redirect path
        const redirectPath = localStorage.getItem("redirectPath");
        if (redirectPath && redirectPath !== "/login") {
          localStorage.removeItem("redirectPath");
          navigate(redirectPath);
        } else {
          navigate("/");
        }
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if there's a saved redirect path
      const redirectPath = localStorage.getItem("redirectPath");
      if (redirectPath && redirectPath !== "/login") {
        localStorage.removeItem("redirectPath");
        navigate(redirectPath);
      } else {
        if (userData.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="max-w-md w-full bg-white border border-neutral-200 p-6 sm:p-8 md:p-12"
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-light text-neutral-900 mb-8 tracking-tight"
        >
          {isAdminLogin ? "Admin Login" : "Welcome"}
        </motion.h1>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-md"
          >
            {error}
          </motion.div>
        )}

        {!isAdminLogin ? (
          <form onSubmit={handleAnonymousLogin}>
            <motion.input
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 mb-6 text-sm"
              required
            />
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className={`w-full bg-neutral-900 text-white py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200 ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Creating Account..." : "Start Quiz"}
            </motion.button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-6"
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 text-sm"
                required
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 text-sm"
                required
              />
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className={`w-full bg-neutral-900 text-white py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200 ${
                loading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {loading ? "Logging in..." : "Log In"}
            </motion.button>
          </form>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-center"
        >
          <button
            onClick={() => {
              setIsAdminLogin(!isAdminLogin);
              setError("");
            }}
            className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            {isAdminLogin
              ? "← Back to user login"
              : "Log in with admin account →"}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
