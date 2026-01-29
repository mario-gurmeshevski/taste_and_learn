import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaSpinner } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { sanitizeText } from "../lib/sanitize";

const Login: React.FC = () => {
  const { isAuthenticated, checkingAuth, loading, signInAnonymously, signInWithPassword } = useAuth();
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const hasRedirectedRef = React.useRef(false);

  // Handle redirect when authenticated
  useEffect(() => {
    if (isAuthenticated && !checkingAuth && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;

      // Check if there's a saved redirect path
      const redirectPath = localStorage.getItem("redirectPath");

      if (redirectPath && redirectPath !== "/login") {
        localStorage.removeItem("redirectPath");
        navigate(redirectPath, { replace: true });
      } else {
        navigate("/quiz", { replace: true });
      }
    }
  }, [isAuthenticated, checkingAuth, navigate]);

  // Show loading while checking auth
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

  // Don't render login form if authenticated
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <FaSpinner className="w-12 h-12 animate-spin mx-auto text-neutral-900" />
          <p className="mt-4 text-neutral-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleAnonymousLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    setError("");

    try {
      await signInAnonymously(userName);
      // Navigation will be handled by useEffect
    } catch {
      const errorMsg = "Error creating account. Please try again.";
      setError(sanitizeText(errorMsg));
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await signInWithPassword(email, password);
      // Navigation will be handled by useEffect
    } catch (err) {
      setError(sanitizeText(err instanceof Error ? err.message : "An unexpected error occurred. Please try again."));
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
              aria-label="Enter your name to start the quiz"
              aria-describedby="name-description"
            />
            <span id="name-description" className="sr-only">
              Enter your display name for the quiz session
            </span>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              aria-label="Start quiz with provided name"
              aria-busy={loading}
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
                aria-label="Email address for admin login"
                aria-describedby="email-description"
              />
              <span id="email-description" className="sr-only">
                Enter your admin email address
              </span>
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
                aria-label="Password for admin login"
                aria-describedby="password-description"
              />
              <span id="password-description" className="sr-only">
                Enter your admin password
              </span>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              aria-label="Log in as admin"
              aria-busy={loading}
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
            aria-label={
              isAdminLogin
                ? "Switch to user login"
                : "Switch to admin login"
            }
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
