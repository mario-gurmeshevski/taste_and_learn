import React, { useState, useEffect } from "react";
import supabase from "../lib/supabase";

interface LeaderboardUser {
  id: string;
  name: string;
  totalScore: number;
  isCurrentUser?: boolean;
}

const Leaderboard: React.FC = () => {
  const [topUsers, setTopUsers] = useState<LeaderboardUser[]>([]);
  const [allUsers, setAllUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (userData) {
          setCurrentUser(userData);
        }
      }
    };

    checkAuth();
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Get all users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name");

      if (usersError) throw usersError;

      // Get all answers to calculate scores
      const { data: answersData, error: answersError } =
        await supabase.from("answers").select("user_id, score");

      if (answersError) throw answersError;

      // Calculate total scores for each user
      const userScoresMap: Record<string, number> = {};

      answersData.forEach((answer) => {
        if (userScoresMap[answer.user_id]) {
          userScoresMap[answer.user_id] += answer.score;
        } else {
          userScoresMap[answer.user_id] = answer.score;
        }
      });

      // Combine user data with calculated scores
      const usersWithScores = usersData.map((user) => ({
        id: user.id,
        name: user.name,
        totalScore: userScoresMap[user.id] || 0,
        isCurrentUser: currentUser && user.id === currentUser.id,
      }));

      const sortedUsers = usersWithScores.sort(
        (a, b) => b.totalScore - a.totalScore,
      );

      setAllUsers(sortedUsers);
      setTopUsers(sortedUsers.slice(0, 5));
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const currentUserRank =
    allUsers.findIndex((user) => user.isCurrentUser) + 1;

  return (
    <div className="bg-white border border-neutral-200 p-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {/* Second place */}
        <div className="flex flex-col items-center md:order-1">
          <span className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
            Second
          </span>
          <div className="w-full border border-neutral-200 bg-neutral-50 p-6 flex flex-col items-center justify-center min-h-35">
            {topUsers[1] ? (
              <>
                <div
                  className={`text-xl font-medium mb-2 ${
                    topUsers[1].isCurrentUser
                      ? "text-blue-600 font-bold"
                      : "text-neutral-900"
                  }`}
                >
                  {topUsers[1].name}
                </div>
                <div
                  className={`text-sm ${
                    topUsers[1].isCurrentUser
                      ? "text-blue-600 font-medium"
                      : "text-neutral-600"
                  }`}
                >
                  {topUsers[1].totalScore} points
                </div>
              </>
            ) : (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </div>
        </div>

        {/* First place */}
        <div className="flex flex-col items-center md:order-2">
          <span className="text-xs uppercase tracking-wider text-neutral-900 font-medium mb-4">
            First
          </span>
          <div className="w-full border-2 border-neutral-900 bg-white p-8 flex flex-col items-center justify-center min-h-40">
            {topUsers[0] ? (
              <>
                <div
                  className={`text-2xl font-medium mb-2 ${
                    topUsers[0].isCurrentUser
                      ? "text-blue-600 font-bold"
                      : "text-neutral-900"
                  }`}
                >
                  {topUsers[0].name}
                </div>
                <div
                  className={`text-base ${
                    topUsers[0].isCurrentUser
                      ? "text-blue-600 font-medium"
                      : "text-neutral-600"
                  }`}
                >
                  {topUsers[0].totalScore} points
                </div>
              </>
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </div>
        </div>

        {/* Third place */}
        <div className="flex flex-col items-center md:order-3">
          <span className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
            Third
          </span>
          <div className="w-full border border-neutral-200 bg-neutral-50 p-6 flex flex-col items-center justify-center min-h-35">
            {topUsers[2] ? (
              <>
                <div
                  className={`text-xl font-medium mb-2 ${
                    topUsers[2].isCurrentUser
                      ? "text-blue-600 font-bold"
                      : "text-neutral-900"
                  }`}
                >
                  {topUsers[2].name}
                </div>
                <div
                  className={`text-sm ${
                    topUsers[2].isCurrentUser
                      ? "text-blue-600 font-medium"
                      : "text-neutral-600"
                  }`}
                >
                  {topUsers[2].totalScore} points
                </div>
              </>
            ) : (
              <span className="text-neutral-400 text-sm">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Current user's position */}
      {currentUser && currentUserRank > 0 && currentUserRank > 5 && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-800">
                Your Position
              </span>
              <span className="text-sm font-bold text-blue-900">
                {currentUser.name}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-700">
                #{currentUserRank}
              </span>
              <span className="text-sm text-blue-700">
                {allUsers.find((u) => u.isCurrentUser)?.totalScore}{" "}
                pts
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Remaining places */}
      {topUsers.slice(3).length > 0 && (
        <div className="border-t border-neutral-200 pt-8">
          <div className="space-y-3 max-w-md mx-auto">
            {topUsers.slice(3).map((user, index) => (
              <div
                key={user.id}
                className={`flex justify-between items-center py-3 border-b border-neutral-100 last:border-0 ${
                  user.isCurrentUser
                    ? "bg-blue-50 border-blue-200 rounded-md p-2"
                    : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`text-sm w-6 ${
                      user.isCurrentUser
                        ? "text-blue-800 font-bold"
                        : "text-neutral-500"
                    }`}
                  >
                    {index + 4}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      user.isCurrentUser
                        ? "text-blue-900"
                        : "text-neutral-900"
                    }`}
                  >
                    {user.name}
                  </span>
                </div>
                <span
                  className={`text-sm ${
                    user.isCurrentUser
                      ? "text-blue-800 font-medium"
                      : "text-neutral-600"
                  }`}
                >
                  {user.totalScore} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
