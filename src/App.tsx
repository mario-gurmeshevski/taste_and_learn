import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import { useEffect } from "react";
import Home from "./components/Home";
import Quiz from "./components/Quiz";
import LeaderboardPage from "./components/LeaderboardPage";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import ProtectedRoute from "./components/ProtectedRoute";
import supabase from "./lib/supabase";

function App() {
  useEffect(() => {
    const initAuth = async () => {
      // Check if user has a session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // No session exists - sign in anonymously for realtime
        console.log("No session found, signing in anonymously...");
        const { data, error } =
          await supabase.auth.signInAnonymously();

        if (error) {
          console.error("Anonymous sign-in error:", error);
          return;
        }

        console.log("✅ Signed in anonymously");

        // Set auth token for realtime
        if (data.session?.access_token) {
          supabase.realtime.setAuth(data.session.access_token);
        }
      } else {
        // Existing session - set auth for realtime
        console.log("Existing session found");
        if (session.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      }
    };

    initAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* Allow anonymous access to quiz */}
          <Route path="/quiz" element={<Quiz />} />

          {/* Keep leaderboard protected if needed */}
          <Route
            path="/leaderboard"
            element={
              <ProtectedRoute>
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
