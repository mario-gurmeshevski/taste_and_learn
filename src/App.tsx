import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Home from "./components/Home";
import Quiz from "./components/Quiz";
import LeaderboardPage from "./components/LeaderboardPage";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./components/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { AuthProvider } from "./contexts/AuthContext";
import { BroadcastProvider } from "./contexts/BroadcastContext";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BroadcastProvider>
          <Router>
            <div className="min-h-screen">
              <ErrorBoundary>
                <Navbar />
              </ErrorBoundary>
              <PageTransition />
            </div>
          </Router>
        </BroadcastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const PageTransition: React.FC = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public route - no authentication required */}
        <Route
          path="/login"
          element={
            <ErrorBoundary>
              <Login />
            </ErrorBoundary>
          }
        />

        {/* All other routes require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Home />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <Quiz />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute requireAdmin={true}>
              <ErrorBoundary>
                <LeaderboardPage />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <ErrorBoundary>
                <AdminPanel />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Catch-all route for undefined paths */}
        <Route
          path="*"
          element={
            <ErrorBoundary>
              <NotFound />
            </ErrorBoundary>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};

export default App;
