import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import supabase from "../lib/supabase";

const Navbar: React.FC = () => {
  const location = useLocation();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    // Check current session on mount and route changes
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const isAnonUser = session.user.is_anonymous || false;
        setIsAnonymous(isAnonUser);

        if (!isAnonUser) {
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (userData) {
            setCurrentUser(userData);
          }
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setIsAnonymous(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const isAnonUser = session.user.is_anonymous || false;
        setIsAnonymous(isAnonUser);

        if (!isAnonUser) {
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (userData) {
            setCurrentUser(userData);
          }
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setIsAnonymous(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/quiz", label: "Quiz" }, // ✅ Always visible
    ...(!isAnonymous && currentUser
      ? [{ path: "/leaderboard", label: "Leaderboard" }]
      : []),
    ...(currentUser?.role === "admin"
      ? [{ path: "/admin", label: "Admin Panel" }]
      : []),
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAnonymous(false);

    // Sign in anonymously again for continued realtime access
    const { data } = await supabase.auth.signInAnonymously();
    if (data.session?.access_token) {
      supabase.realtime.setAuth(data.session.access_token);
    }
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 w-full bg-white backdrop-blur-md shadow-sm"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => setHoveredPath(item.path)}
                onMouseLeave={() => setHoveredPath(null)}
                className={`relative px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${
                  isActive(item.path)
                    ? "text-white"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {isActive(item.path) && (
                  <motion.div
                    layoutId="activeBackground"
                    className="absolute inset-0 bg-neutral-900 rounded-full shadow-md"
                    style={{ zIndex: -1 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />
                )}

                {hoveredPath === item.path &&
                  !isActive(item.path) && (
                    <motion.div
                      layoutId="hoverBackground"
                      className="absolute inset-0 bg-neutral-100 rounded-full"
                      style={{ zIndex: -1 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    />
                  )}

                <span className="relative z-10">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center">
            {currentUser && !isAnonymous ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-neutral-700 hidden sm:block">
                  Welcome, {currentUser.name}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="rounded-lg bg-neutral-200 px-5 py-2 text-sm font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
                >
                  Logout
                </motion.button>
              </div>
            ) : (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center"
              >
                <Link
                  to="/login"
                  className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
                >
                  Log in
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
