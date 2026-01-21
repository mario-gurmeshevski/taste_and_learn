import React from "react";
import { motion } from "framer-motion";
import Leaderboard from "./Leaderboard";

const LeaderboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4 pt-24">
      <div className="max-w-5xl mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            type: "spring",
            stiffness: 100,
          }}
          className="text-4xl md:text-5xl font-light text-neutral-900 mb-12 tracking-tight"
        >
          Leaderboard
        </motion.h1>
        <Leaderboard />
      </div>
    </div>
  );
};

export default LeaderboardPage;
