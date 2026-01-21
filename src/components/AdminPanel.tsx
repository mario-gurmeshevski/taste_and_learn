import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import {
  FaPlay,
  FaPause,
  FaRedo,
  FaBackward,
  FaForward,
  FaSpinner,
} from "react-icons/fa";
import toast from "react-hot-toast";
import supabase from "../lib/supabase";
import videoFile from "../assets/video.mp4";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import type { BroadcastState, PlyrRef, User } from "../config/types";
import {
  ADMIN_SYNC_INTERVAL,
  SKIP_AMOUNT,
  BROADCAST_CHANNEL_NAME,
  DB_TABLES,
  USER_ROLES,
  DB_FIELDS,
} from "../config/constants";

const AdminPanel: React.FC = () => {
  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const plyrRef = useRef<PlyrRef>(null);
  const isUpdating = useRef(false);
  const broadcastStateRef = useRef<BroadcastState | null>(null);
  const broadcastChannelRef = useRef<any>(null);

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
        .from(DB_TABLES.USERS)
        .select("*")
        .eq(DB_FIELDS.ID, session.user.id)
        .maybeSingle();

      if (!userData || userData.role !== USER_ROLES.ADMIN) {
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

        const { error } = await supabase
          .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
          .update(updateData)
          .eq("id", broadcastStateRef.current.id);

        if (!error) {
          setBroadcastState((prev) =>
            prev
              ? {
                  ...prev,
                  ...updates,
                  updated_at: updateData.updated_at as string,
                  updated_by: updateData.updated_by as string,
                }
              : null,
          );

          // Send broadcast update to all subscribers
          // Use updateData which includes the new updated_at timestamp
          const updatedState = broadcastStateRef.current
            ? { ...broadcastStateRef.current, ...updateData }
            : (updateData as BroadcastState);

          if (broadcastChannelRef.current) {
            broadcastChannelRef.current
              .send({
                type: "broadcast",
                event: "broadcast-state-update",
                payload: updatedState,
              })
              .catch((err: any) =>
                console.error("Broadcast error:", err),
              );
          } else {
            console.warn("Broadcast channel not ready");
          }
        } else {
          console.error("Update failed:", error);
        }
      } finally {
        isUpdating.current = false;
      }
    },
    [currentUser],
  );

  useEffect(() => {
    if (!isPlayerReady || !broadcastState?.is_playing) return;

    const syncInterval = setInterval(() => {
      if (plyrRef.current?.plyr) {
        const currentTime = plyrRef.current.plyr.currentTime;
        updateBroadcastState({ current_position: currentTime });
      }
    }, ADMIN_SYNC_INTERVAL);

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
        .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
        .select("*")
        .maybeSingle();

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

    // Set up broadcast channel for sending updates
    const channel = supabase
      .channel(BROADCAST_CHANNEL_NAME)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          broadcastChannelRef.current = channel;
        }
      });

    return () => {
      // Clear the ref when channel is removed
      broadcastChannelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
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

      toast.success("Broadcast started", { icon: "▶️" });
    } catch (error) {
      console.error("Error in handlePlay:", error);
      toast.error("Failed to start broadcast");
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

      toast.success("Broadcast paused", { icon: "⏸️" });
    } catch (error) {
      console.error("Error in handlePause:", error);
      toast.error("Failed to pause broadcast");
    }
  };

  const handleSeek = async (seconds: number) => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      plyrRef.current.plyr.currentTime = seconds;
      await updateBroadcastState({ current_position: seconds });
    } catch (error) {
      console.error("Error in handleSeek:", error);
      toast.error("Failed to seek video");
    }
  };

  const handleRestart = async () => {
    if (plyrRef.current?.plyr) {
      plyrRef.current.plyr.pause();
    }
    await handleSeek(0);
    await updateBroadcastState({
      is_playing: false,
      current_position: 0,
    });
    toast.success("Broadcast restarted from beginning", {
      icon: "🔄",
    });
  };

  const handleSkipForward = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;
      await handleSeek(currentTime + SKIP_AMOUNT);
      toast(`Skipped forward ${SKIP_AMOUNT} seconds`, { icon: "⏩" });
    } catch (error) {
      console.error("Error in handleSkipForward:", error);
      toast.error("Failed to skip forward");
    }
  };

  const handleSkipBackward = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;
      await handleSeek(Math.max(0, currentTime - SKIP_AMOUNT));
      toast(`Skipped backward ${SKIP_AMOUNT} seconds`, {
        icon: "⏪",
      });
    } catch (error) {
      console.error("Error in handleSkipBackward:", error);
      toast.error("Failed to skip backward");
    }
  };

  if (loading) {
    return (
      <div className="pt-16 bg-black min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!currentUser || currentUser.role !== USER_ROLES.ADMIN) {
    return null;
  }

  return (
    <div className="pt-16 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-neutral-900 border border-neutral-700 p-3 sm:p-4 mb-3 sm:mb-4 rounded-lg"
        >
          <h2 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">
            Admin Broadcast Controls
          </h2>

          <div
            className="flex flex-wrap gap-2 mb-3 sm:mb-4"
            role="group"
            aria-label="Broadcast controls"
          >
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
              aria-label="Start or play broadcast"
              className={`${
                isPlayerReady
                  ? "bg-green-500/30 border-green-400/30 shadow-lg shadow-green-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
            >
              <FaPlay className="text-sm" aria-hidden="true" />{" "}
              Start/Play
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
              aria-label="Pause broadcast"
              className={`${
                isPlayerReady
                  ? "bg-yellow-500/30 border-yellow-400/30 shadow-lg shadow-yellow-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
            >
              <FaPause className="text-sm" aria-hidden="true" /> Pause
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
              aria-label="Restart broadcast from beginning"
              className={`${
                isPlayerReady
                  ? "bg-blue-500/30 border-blue-400/30 shadow-lg shadow-blue-500/20"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
            >
              <FaRedo className="text-sm" aria-hidden="true" />{" "}
              Restart
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
              aria-label={`Skip backward ${SKIP_AMOUNT} seconds`}
              className={`${
                isPlayerReady
                  ? "bg-neutral-400/20 border-neutral-400/20 shadow-lg shadow-neutral-500/10"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
            >
              <FaBackward className="text-sm" aria-hidden="true" />{" "}
              -10s
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
              aria-label={`Skip forward ${SKIP_AMOUNT} seconds`}
              className={`${
                isPlayerReady
                  ? "bg-neutral-400/20 border-neutral-400/20 shadow-lg shadow-neutral-500/10"
                  : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
              } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
            >
              <FaForward className="text-sm" aria-hidden="true" />{" "}
              +10s
            </motion.button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-white text-xs sm:text-sm"
          >
            <p>
              Status:
              <span className="font-bold flex items-center gap-2">
                {broadcastState?.is_playing ? (
                  <>
                    <FaPlay aria-hidden="true" /> Playing
                  </>
                ) : (
                  <>
                    <FaPause aria-hidden="true" /> Paused
                  </>
                )}
              </span>
            </p>
            <p>
              Current Time:
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
                <FaSpinner className="animate-spin h-12 w-12 mx-auto" />
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
