import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaCrown, FaBars, FaTimes, FaUser } from "react-icons/fa";
import toast from "react-hot-toast";
import supabase from "../lib/supabase";
import type { User } from "../config/types";
import {
  SPRING_STIFFNESS,
  SPRING_DAMPING,
  DB_TABLES,
  USER_ROLES,
  ROUTES,
  DB_FIELDS,
} from "../config/constants";

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check current session on mount
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setIsAuthenticated(true);
        // Fetch user data from database (works for both anonymous and regular users)
        const { data: userData } = await supabase
          .from(DB_TABLES.USERS)
          .select("*")
          .eq(DB_FIELDS.ID, session.user.id)
          .maybeSingle();

        if (userData) {
          setCurrentUser(userData);
          setIsAdmin(userData.role === USER_ROLES.ADMIN);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAdmin(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);

        const { data: userData } = await supabase
          .from(DB_TABLES.USERS)
          .select("*")
          .eq(DB_FIELDS.ID, session.user.id)
          .maybeSingle();

        if (userData) {
          setCurrentUser(userData);
          setIsAdmin(userData.role === USER_ROLES.ADMIN);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = isAuthenticated
    ? [
        { path: "/", label: "Home" },
        { path: "/quiz", label: "Quiz" },
        ...(isAdmin
          ? [
              { path: "/leaderboard", label: "Leaderboard" },
              { path: "/admin", label: "Admin Panel" },
            ]
          : []),
      ]
    : [];

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
      setIsAdmin(false);
      setIsAuthenticated(false);
      toast.success("Logged out successfully", { icon: "👋" });
      navigate(ROUTES.LOGIN);
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to log out");
    }
  };

  // Hide navbar on login page
  if (location.pathname === "/login") {
    return null;
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 w-full bg-white/95 backdrop-blur-md shadow-sm border-b border-neutral-200"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 md:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => setHoveredPath(item.path)}
                onMouseLeave={() => setHoveredPath(null)}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`relative px-3 lg:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200 ${
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
                      stiffness: SPRING_STIFFNESS,
                      damping: SPRING_DAMPING,
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

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <FaTimes className="w-5 h-5" aria-hidden="true" />
              ) : (
                <FaBars className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* User Section - Desktop Only */}
          <div className="hidden md:flex items-center">
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-2 lg:gap-4">
                <div className="flex items-center gap-2">
                  <FaUser
                    className="text-neutral-500 text-sm"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-neutral-700 font-medium truncate max-w-37.5">
                    {currentUser.name}#{currentUser.discriminator}
                  </span>
                  {isAdmin && (
                    <span className="text-yellow-500">
                      <FaCrown
                        className="text-sm"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  aria-label="Log out of your account"
                  className="rounded-lg bg-neutral-200 px-4 lg:px-5 py-2 text-sm font-medium text-neutral-700 transition-all duration-200 hover:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
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
                  className="rounded-lg bg-neutral-900 px-4 lg:px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-800 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2"
                >
                  Log in
                </Link>
              </motion.div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-3 space-y-1 border-t border-neutral-200">
                {navItems.map((item, index) => (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.path)
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-700 hover:bg-neutral-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
                {isAuthenticated && currentUser && (
                  <>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: navItems.length * 0.1 }}
                      className="pt-2 border-t border-neutral-200 mt-2"
                    >
                      <div className="px-3 py-2 flex items-center gap-2 text-sm text-neutral-700">
                        <FaUser
                          className="text-neutral-500"
                          aria-hidden="true"
                        />
                        <span className="font-medium">
                          {currentUser.name}#{currentUser.discriminator}
                        </span>
                        {isAdmin && (
                          <FaCrown
                            className="text-yellow-500 ml-1"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: (navItems.length + 1) * 0.1,
                      }}
                    >
                      <button
                        onClick={() => {
                          handleLogout();
                          setIsMobileMenuOpen(false);
                        }}
                        aria-label="Log out of your account"
                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Logout
                      </button>
                    </motion.div>
                  </>
                )}
                {!isAuthenticated && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: navItems.length * 0.1 }}
                  >
                    <Link
                      to="/login"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                    >
                      Log in
                    </Link>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

export default Navbar;
