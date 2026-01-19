import React from "react";
import Leaderboard from "./Leaderboard";

const LeaderboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4 pt-24">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-light text-neutral-900 mb-12 tracking-tight">
          Leaderboard
        </h1>
        <Leaderboard />
      </div>
    </div>
  );
};

export default LeaderboardPage;
