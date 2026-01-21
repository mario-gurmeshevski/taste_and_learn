import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FaSpinner } from "react-icons/fa";
import supabase from "../lib/supabase";

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    checkAuth();
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

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Store the attempted path for redirect after login
    localStorage.setItem("redirectPath", location.pathname);
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="max-w-2xl w-full bg-white border border-neutral-200 p-16 text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-8xl font-light text-neutral-900 mb-4"
        >
          404
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-light text-neutral-900 mb-6"
        >
          Page Not Found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-neutral-600 mb-8"
        >
          The page you're looking for doesn't exist or has been moved.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/")}
            className="bg-neutral-900 text-white px-8 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200"
          >
            Go to Home
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="bg-white border border-neutral-300 text-neutral-900 px-8 py-3 text-sm font-medium hover:bg-neutral-50 transition-colors duration-200"
          >
            Go Back
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;
