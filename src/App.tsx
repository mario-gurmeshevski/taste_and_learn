import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";
import Home from "./components/Home";
import Quiz from "./components/Quiz";
import LeaderboardPage from "./components/LeaderboardPage";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
