import React, { useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  type Variants,
} from "framer-motion";
import { FaLock, FaSpinner } from "react-icons/fa";
import supabase from "../lib/supabase";
import { sanitizeText } from "../lib/sanitize";
import type { LeaderboardUser } from "../config/types";
import { DB_TABLES, USER_ROLES, DB_FIELDS, SORT_ORDER } from "../config/constants";

const Leaderboard: React.FC = () => {
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllContestants, setShowAllContestants] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session?.user) {
          setError("Please log in to view the leaderboard");
          setLoading(false);
          return;
        }

        try {
          const { data: userData, error: userError } = await supabase
            .from(DB_TABLES.USERS)
            .select("*")
            .eq(DB_FIELDS.ID, session.user.id)
            .maybeSingle();

          if (userError) throw userError;

          if (!userData) {
            setError("User not found");
            setLoading(false);
            return;
          }

          if (userData.role !== USER_ROLES.ADMIN) {
            setError("Access denied. Admin privileges required.");
            setIsAdmin(false);
            setLoading(false);
            return;
          }

          setIsAdmin(true);
          await fetchLeaderboard(userData.id);
        } catch {
          setError("Failed to load leaderboard");
          setLoading(false);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const fetchLeaderboard = async (currentUserId: string) => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name, discriminator");

      if (usersError) throw usersError;

      const { data: sessionsData, error: sessionsError } =
        await supabase
          .from(DB_TABLES.QUIZ_SESSIONS)
          .select(`${DB_FIELDS.USER_ID}, ${DB_FIELDS.TOTAL_SCORE}, ${DB_FIELDS.COMPLETED_AT}`)
          .not(DB_FIELDS.COMPLETED_AT, "is", null)
          .order(DB_FIELDS.TOTAL_SCORE, { ascending: SORT_ORDER.DESCENDING });

      if (sessionsError) throw sessionsError;

      const userStatsMap: Record<
        string,
        {
          bestScore: number;
          attempts: number;
          lastAttempt: string | null;
        }
      > = {};

      sessionsData.forEach((session) => {
        if (!userStatsMap[session.user_id]) {
          userStatsMap[session.user_id] = {
            bestScore: session.total_score,
            attempts: 1,
            lastAttempt: session.completed_at,
          };
        } else {
          userStatsMap[session.user_id].attempts += 1;
          if (
            session.total_score >
            userStatsMap[session.user_id].bestScore
          ) {
            userStatsMap[session.user_id].bestScore =
              session.total_score;
          }
          if (
            session.completed_at &&
            (!userStatsMap[session.user_id].lastAttempt ||
              session.completed_at >
                userStatsMap[session.user_id].lastAttempt!)
          ) {
            userStatsMap[session.user_id].lastAttempt =
              session.completed_at;
          }
        }
      });

      const usersWithScores = usersData
        .filter((user) => userStatsMap[user.id])
        .map((user) => ({
          id: user.id,
          name: sanitizeText(user.name),
          discriminator: sanitizeText(user.discriminator),
          totalScore: userStatsMap[user.id].bestScore,
          attemptsCount: userStatsMap[user.id].attempts,
          lastAttempt: userStatsMap[user.id].lastAttempt,
          isCurrentUser: user.id === currentUserId,
        }));

      const sortedUsers = usersWithScores.sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore;
        }
        return a.attemptsCount - b.attemptsCount;
      });

      setTopUsers(sortedUsers.slice(0, 10));
    } catch {
      setError("Failed to fetch leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="w-8 h-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  if (error || !isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white border border-neutral-200 p-12 text-center"
      >
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring" as const,
              stiffness: 260,
              damping: 20,
              delay: 0.2,
            }}
          >
            <FaLock className="h-16 w-16 mx-auto mb-4 text-neutral-400" />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-light text-neutral-900 mb-4"
          >
            Access Restricted
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-neutral-600 mb-6"
          >
            {error ||
              "You need admin privileges to view the leaderboard."}
          </motion.p>
          <motion.a
            href="/"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block bg-neutral-900 text-white px-6 py-2 text-sm hover:bg-neutral-800 transition-colors"
          >
            Back to Home
          </motion.a>
        </div>
      </motion.div>
    );
  }

  const podiumVariants: Variants = {
    hidden: { opacity: 0, y: 50 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
        delay: custom * 0.15,
      },
    }),
  };

  const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="bg-white border border-neutral-200 p-12"
    >
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6 flex justify-end"
      >
        <span className="bg-neutral-900 text-white px-3 py-1 text-xs uppercase tracking-wider">
          Admin View
        </span>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* Second place */}
        <motion.div
          custom={1}
          variants={podiumVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center md:order-1"
        >
          <span className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
            Second
          </span>
          <motion.div
            whileHover={{ scale: 1.03, borderColor: "#404040" }}
            transition={{ type: "spring" as const, stiffness: 300 }}
            className="w-full border border-neutral-200 bg-neutral-50 p-6 flex flex-col items-center justify-center min-h-35"
          >
            {topUsers[1] ? (
              <>
                <div className="text-xl font-medium mb-2 text-neutral-900">
                  {topUsers[1].name}
                  <span className="text-neutral-400 ml-2">
                    #{topUsers[1].discriminator}
                  </span>
                </div>
                <div className="text-sm text-neutral-600">
                  {topUsers[1].totalScore} points
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {topUsers[1].attemptsCount} attempt
                  {topUsers[1].attemptsCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </motion.div>
        </motion.div>

        {/* First place */}
        <motion.div
          custom={0}
          variants={podiumVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center md:order-2"
        >
          <span className="text-xs uppercase tracking-wider text-neutral-900 font-medium mb-4">
            First
          </span>
          <motion.div
            whileHover={{ scale: 1.05, y: -5 }}
            transition={{ type: "spring" as const, stiffness: 300 }}
            className="w-full border-2 border-neutral-900 bg-white p-8 flex flex-col items-center justify-center min-h-40"
          >
            {topUsers[0] ? (
              <>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 200,
                    delay: 0.4,
                  }}
                  className="text-2xl font-medium mb-2 text-neutral-900"
                >
                  {topUsers[0].name}
                  <span className="text-neutral-400 ml-2">
                    #{topUsers[0].discriminator}
                  </span>
                </motion.div>
                <div className="text-base text-neutral-600">
                  {topUsers[0].totalScore} points
                </div>
                <div className="text-sm text-neutral-400 mt-1">
                  {topUsers[0].attemptsCount} attempt
                  {topUsers[0].attemptsCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </motion.div>
        </motion.div>

        {/* Third place */}
        <motion.div
          custom={2}
          variants={podiumVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center md:order-3"
        >
          <span className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
            Third
          </span>
          <motion.div
            whileHover={{ scale: 1.03, borderColor: "#404040" }}
            transition={{ type: "spring" as const, stiffness: 300 }}
            className="w-full border border-neutral-200 bg-neutral-50 p-6 flex flex-col items-center justify-center min-h-35"
          >
            {topUsers[2] ? (
              <>
                <div className="text-xl font-medium mb-2 text-neutral-900">
                  {topUsers[2].name}
                  <span className="text-neutral-400 ml-2">
                    #{topUsers[2].discriminator}
                  </span>
                </div>
                <div className="text-sm text-neutral-600">
                  {topUsers[2].totalScore} points
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {topUsers[2].attemptsCount} attempt
                  {topUsers[2].attemptsCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Fourth and Fifth place */}
      <div className="grid grid-cols-2 gap-6 mb-8 max-w-2xl mx-auto">
        {/* Fourth place */}
        <motion.div
          custom={3}
          variants={podiumVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          <span className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            Fourth
          </span>
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring" as const, stiffness: 300 }}
            className="w-full border border-neutral-200 bg-neutral-50 p-5 flex flex-col items-center justify-center"
          >
            {topUsers[3] ? (
              <>
                <div className="text-lg font-medium mb-1 text-neutral-900">
                  {topUsers[3].name}
                  <span className="text-neutral-400 ml-2 text-sm">
                    #{topUsers[3].discriminator}
                  </span>
                </div>
                <div className="text-sm text-neutral-600">
                  {topUsers[3].totalScore} pts
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {topUsers[3].attemptsCount} attempt
                  {topUsers[3].attemptsCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </motion.div>
        </motion.div>

        {/* Fifth place */}
        <motion.div
          custom={4}
          variants={podiumVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          <span className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
            Fifth
          </span>
          <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring" as const, stiffness: 300 }}
            className="w-full border border-neutral-200 bg-neutral-50 p-5 flex flex-col items-center justify-center"
          >
            {topUsers[4] ? (
              <>
                <div className="text-lg font-medium mb-1 text-neutral-900">
                  {topUsers[4].name}
                  <span className="text-neutral-400 ml-2 text-sm">
                    #{topUsers[4].discriminator}
                  </span>
                </div>
                <div className="text-sm text-neutral-600">
                  {topUsers[4].totalScore} pts
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {topUsers[4].attemptsCount} attempt
                  {topUsers[4].attemptsCount !== 1 ? "s" : ""}
                </div>
              </>
            ) : (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Show all contestants button */}
      {topUsers.length > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex justify-center mb-6"
        >
          <motion.button
            onClick={() => setShowAllContestants(!showAllContestants)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            {showAllContestants ? (
              <>
                <span>Hide</span>
                <svg
                  className="w-4 h-4 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </>
            ) : (
              <>
                <span>Show All Contestants</span>
                <svg
                  className="w-4 h-4 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </>
            )}
          </motion.button>
        </motion.div>
      )}

      <AnimatePresence>
        {showAllContestants && topUsers.slice(5).length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="border-t border-neutral-200 pt-8"
          >
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3 max-w-md mx-auto"
            >
              {topUsers.slice(5).map((user, index) => (
                <motion.div
                  key={user.id}
                  variants={itemVariants}
                  whileHover={{ x: 5, backgroundColor: "#fafafa" }}
                  transition={{
                    type: "spring" as const,
                    stiffness: 300,
                  }}
                  className="flex justify-between items-center py-3 border-b border-neutral-100 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-8 text-neutral-500 font-medium">
                      {index + 6}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-neutral-900">
                        {user.name}
                        <span className="text-neutral-400 ml-1">
                          #{user.discriminator}
                        </span>
                      </span>
                      <div className="text-xs text-neutral-400">
                        {user.attemptsCount} attempt
                        {user.attemptsCount !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-neutral-600 font-medium">
                    {user.totalScore} pts
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Leaderboard;
