import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import Home from "./components/Home";
import Quiz from "./components/Quiz";
import LeaderboardPage from "./components/LeaderboardPage";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./components/NotFound";
import supabase from "./lib/supabase";

function App() {
  useEffect(() => {
    const initAuth = async () => {
      // Check if user has a session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Set auth token for realtime if session exists
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <PageTransition />
      </div>
    </Router>
  );
}

const PageTransition: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public route - no authentication required */}
        <Route path="/login" element={<Login />} />

        {/* All other routes require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <Quiz />
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute requireAdmin={true}>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route for undefined paths */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

export default App;
