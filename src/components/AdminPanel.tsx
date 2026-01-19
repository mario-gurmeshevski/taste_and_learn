import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import supabase from "../lib/supabase";
import videoFile from "../assets/video.mp4";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";

interface BroadcastState {
  id: number;
  current_position: number;
  is_playing: boolean;
  updated_at: string;
}

interface PlyrRef {
  plyr: any;
}

const AdminPanel: React.FC = () => {
  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const plyrRef = useRef<PlyrRef>(null);
  const isUpdating = useRef(false);
  const broadcastStateRef = useRef<BroadcastState | null>(null);

  const videoSrc = useMemo(
    () => ({
      type: "video" as const,
      sources: [{ src: videoFile, type: "video/mp4" }],
    }),
    [],
  );

  const videoOptions = useMemo(
    () => ({
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "pip",
        "airplay",
        "fullscreen",
      ],
    }),
    [],
  );

  useEffect(() => {
    broadcastStateRef.current = broadcastState;
  }, [broadcastState]);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!userData || userData.role !== "admin") {
        window.location.href = "/";
        return;
      }

      setCurrentUser(userData);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const updateBroadcastState = useCallback(
    async (updates: Partial<BroadcastState>) => {
      if (
        !broadcastStateRef.current ||
        !currentUser ||
        isUpdating.current
      )
        return;

      isUpdating.current = true;

      try {
        const updateData = {
          ...updates,
          updated_by: currentUser.id,
          updated_at: new Date().toISOString(),
        };

        console.log("Updating broadcast state:", updateData);

        const { error } = await supabase
          .from("public_broadcast_state")
          .update(updateData)
          .eq("id", broadcastStateRef.current.id);

        if (!error) {
          console.log("✅ Update successful");
          setBroadcastState((prev) =>
            prev ? { ...prev, ...updates } : null,
          );
        } else {
          console.error("❌ Update failed:", error);
        }
      } finally {
        isUpdating.current = false;
      }
    },
    [currentUser],
  );

  // Optional: Periodic sync every 30 seconds during playback to prevent drift
  useEffect(() => {
    if (!isPlayerReady || !broadcastState?.is_playing) return;

    const syncInterval = setInterval(() => {
      if (plyrRef.current?.plyr) {
        const currentTime = plyrRef.current.plyr.currentTime;
        console.log("Heartbeat sync:", currentTime);
        updateBroadcastState({ current_position: currentTime });
      }
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [
    isPlayerReady,
    broadcastState?.is_playing,
    updateBroadcastState,
  ]);

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkReady = () => {
      if (!mounted) return;

      if (plyrRef.current?.plyr) {
        setIsPlayerReady(true);
      } else {
        timeoutId = setTimeout(checkReady, 100);
      }
    };

    checkReady();

    return () => {
      mounted = false;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!isPlayerReady || !currentUser) return;

    const fetchBroadcastState = async () => {
      const { data } = await supabase
        .from("public_broadcast_state")
        .select("*")
        .single();

      if (data && plyrRef.current?.plyr) {
        setBroadcastState(data);

        setTimeout(() => {
          if (plyrRef.current?.plyr && data.current_position > 0) {
            plyrRef.current.plyr.currentTime = data.current_position;
          }

          if (data.is_playing) {
            plyrRef.current?.plyr.play().catch(console.error);
          } else {
            plyrRef.current?.plyr.pause();
          }
        }, 300);
      }
    };

    fetchBroadcastState();
  }, [isPlayerReady, currentUser]);

  const handlePlay = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;

      await updateBroadcastState({
        is_playing: true,
        current_position: currentTime,
      });

      setTimeout(() => {
        plyrRef.current?.plyr.play().catch(console.error);
      }, 100);
    } catch (error) {
      console.error("Error in handlePlay:", error);
    }
  };

  const handlePause = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentPosition = plyrRef.current.plyr.currentTime;
      plyrRef.current.plyr.pause();

      await updateBroadcastState({
        is_playing: false,
        current_position: currentPosition,
      });
    } catch (error) {
      console.error("Error in handlePause:", error);
    }
  };

  const handleSeek = async (seconds: number) => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      plyrRef.current.plyr.currentTime = seconds;
      await updateBroadcastState({ current_position: seconds });
    } catch (error) {
      console.error("Error in handleSeek:", error);
    }
  };

  const handleRestart = async () => {
    await handleSeek(0);
    await updateBroadcastState({
      is_playing: false,
      current_position: 0,
    });
  };

  const handleStop = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;
      plyrRef.current.plyr.pause();

      await updateBroadcastState({
        is_playing: false,
        current_position: currentTime,
      });
    } catch (error) {
      console.error("Error in handleStop:", error);
    }
  };

  const handleSkipForward = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;
      await handleSeek(currentTime + 10);
    } catch (error) {
      console.error("Error in handleSkipForward:", error);
    }
  };

  const handleSkipBackward = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;
      await handleSeek(Math.max(0, currentTime - 10));
    } catch (error) {
      console.error("Error in handleSkipBackward:", error);
    }
  };

  if (loading) {
    return (
      <div className="pt-16 bg-black min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== "admin") {
    return null;
  }

  return (
    <div className="pt-16 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-neutral-900 border border-neutral-700 p-4 mb-4 rounded-lg"
        >
          <h2 className="text-white text-xl font-bold mb-4">
            Admin Broadcast Controls
          </h2>

          <div className="flex flex-wrap gap-2 mb-4">
            <motion.button
              onClick={handlePlay}
              disabled={!isPlayerReady}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              whileHover={
                isPlayerReady
                  ? {
                      scale: 1.05,
                      y: -2,
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={
                isPlayerReady
                  ? { scale: 0.95, transition: { duration: 0.1 } }
                  : {}
              }
              className={`${
                isPlayerReady
                  ? "bg-green-500/30 border-green-400/30 shadow-lg shadow-green-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium border`}
            >
              ▶ Start/Play
            </motion.button>

            <motion.button
              onClick={handlePause}
              disabled={!isPlayerReady}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              whileHover={
                isPlayerReady
                  ? {
                      scale: 1.05,
                      y: -2,
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={
                isPlayerReady
                  ? { scale: 0.95, transition: { duration: 0.1 } }
                  : {}
              }
              className={`${
                isPlayerReady
                  ? "bg-yellow-500/30 border-yellow-400/30 shadow-lg shadow-yellow-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium border`}
            >
              ⏸ Pause
            </motion.button>

            <motion.button
              onClick={handleStop}
              disabled={!isPlayerReady}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              whileHover={
                isPlayerReady
                  ? {
                      scale: 1.05,
                      y: -2,
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={
                isPlayerReady
                  ? { scale: 0.95, transition: { duration: 0.1 } }
                  : {}
              }
              className={`${
                isPlayerReady
                  ? "bg-red-500/30 border-red-400/30 shadow-lg shadow-red-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium border`}
            >
              ⏹ Stop
            </motion.button>

            <motion.button
              onClick={handleRestart}
              disabled={!isPlayerReady}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              whileHover={
                isPlayerReady
                  ? {
                      scale: 1.05,
                      y: -2,
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={
                isPlayerReady
                  ? { scale: 0.95, transition: { duration: 0.1 } }
                  : {}
              }
              className={`${
                isPlayerReady
                  ? "bg-blue-500/30 border-blue-400/30 shadow-lg shadow-blue-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium border`}
            >
              ⏮ Restart
            </motion.button>

            <motion.button
              onClick={handleSkipBackward}
              disabled={!isPlayerReady}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={
                isPlayerReady
                  ? {
                      scale: 1.05,
                      y: -2,
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={
                isPlayerReady
                  ? { scale: 0.95, transition: { duration: 0.1 } }
                  : {}
              }
              className={`${
                isPlayerReady
                  ? "bg-neutral-400/20 border-neutral-400/20 shadow-lg shadow-neutral-500/10"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium border`}
            >
              ⏪ -10s
            </motion.button>

            <motion.button
              onClick={handleSkipForward}
              disabled={!isPlayerReady}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              whileHover={
                isPlayerReady
                  ? {
                      scale: 1.05,
                      y: -2,
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={
                isPlayerReady
                  ? { scale: 0.95, transition: { duration: 0.1 } }
                  : {}
              }
              className={`${
                isPlayerReady
                  ? "bg-neutral-400/20 border-neutral-400/20 shadow-lg shadow-neutral-500/10"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-4 py-2 rounded-lg text-sm font-medium border`}
            >
              ⏩ +10s
            </motion.button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white text-sm"
          >
            <p>
              Status:{" "}
              <span className="font-bold">
                {broadcastState?.is_playing
                  ? "▶ Playing"
                  : "⏸ Paused"}
              </span>
            </p>
            <p>
              Current Time:{" "}
              <span className="font-bold">
                {(broadcastState?.current_position ?? 0).toFixed(2)}s
              </span>
            </p>
          </motion.div>
        </motion.div>

        <div className="w-full h-[calc(100vh-20rem)]">
          {!isPlayerReady && (
            <div className="w-full h-full flex items-center justify-center bg-black text-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
                <p className="mt-4">Loading video player...</p>
              </div>
            </div>
          )}
          <Plyr
            ref={plyrRef}
            source={videoSrc}
            options={videoOptions}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
