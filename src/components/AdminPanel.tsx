import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import supabase from "../lib/supabase";
import { useAbortController } from "../hooks/useAbortController";
import { useAuth } from "../hooks/useAuth";
import "plyr-react/plyr.css";
import type { BroadcastState, PlyrRef } from "../config/types";
import {
  DEBUG_MODE,
  ADMIN_SYNC_INTERVAL,
  BROADCAST_CHANNEL_NAME,
  DB_TABLES,
} from "../config/constants";
import VideoControls from "./admin/VideoControls";
import BroadcastStatus from "./admin/BroadcastStatus";
import VideoPlayer from "./admin/VideoPlayer";
import QRCodeModal from "./admin/QRCodeModal";

const AdminPanel: React.FC = () => {
  if (DEBUG_MODE) console.log("[ADMIN:COMPONENT] AdminPanel mounted");

  const { safeTimeout } = useAbortController();
  const { user } = useAuth();
  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const plyrRef = useRef<PlyrRef>(null);
  const isUpdating = useRef(false);
  const broadcastStateRef = useRef<BroadcastState | null>(null);
  const broadcastChannelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);
  const videoSrc = useMemo(
    () => ({
      type: "video" as const,
      sources: [
        { src: import.meta.env.VITE_VIDEO_URL, type: "video/mp4" },
      ],
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

  const updateBroadcastState = useCallback(
    async (updates: Partial<BroadcastState>) => {
      if (
        !broadcastStateRef.current ||
        !user ||
        isUpdating.current
      )
        return;

      if (DEBUG_MODE) {
        console.log(
          "[ADMIN:UPDATE] Attempting to update broadcast state:",
          updates,
        );
      }

      isUpdating.current = true;

      try {
        const updateData = {
          ...updates,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
          .update(updateData)
          .eq("id", broadcastStateRef.current.id);

        if (!error) {
          if (DEBUG_MODE) {
            console.log("[ADMIN:UPDATE] Successfully updated DB");
          }
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

          const updatedState = broadcastStateRef.current
            ? { ...broadcastStateRef.current, ...updateData }
            : (updateData as BroadcastState);

          if (broadcastChannelRef.current) {
            if (DEBUG_MODE) {
              console.log(
                "[ADMIN:BROADCAST] Sending realtime update to clients",
              );
            }
            broadcastChannelRef.current
              .send({
                type: "broadcast",
                event: "broadcast-state-update",
                payload: updatedState,
              })
              .catch((err) => {
                console.error(
                  "Broadcast send error in AdminPanel:",
                  err,
                );
                toast.error("Failed to broadcast update to clients", {
                  icon: "📡",
                  duration: 3000,
                });
              });
          }
        }
      } finally {
        isUpdating.current = false;
      }
    },
    [user],
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
    if (!isPlayerReady || !user) return;

    const fetchBroadcastState = async () => {
      const { data } = await supabase
        .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
        .select("*")
        .maybeSingle();

      if (data && plyrRef.current?.plyr) {
        setBroadcastState(data);
        safeTimeout(() => {
          if (plyrRef.current?.plyr && data.current_position > 0) {
            plyrRef.current.plyr.currentTime = data.current_position;
          }
          if (data.is_playing) {
            const playPromise = plyrRef.current?.plyr.play();
            if (playPromise instanceof Promise) {
              playPromise.catch((err) => {
                console.error(
                  "Video autoplay failed in AdminPanel:",
                  err,
                );
                toast.error(
                  "Autoplay prevented - please interact with the page",
                  {
                    icon: "🚫",
                    duration: 4000,
                  },
                );
              });
            }
          } else {
            plyrRef.current?.plyr.pause();
          }
        }, 300);
      }
    };

    fetchBroadcastState();

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentChannel: ReturnType<typeof supabase.channel> | null =
      null;

    const setupChannel = () => {
      // Clean up existing channel before creating a new one
      if (DEBUG_MODE) {
        console.log(
          "[ADMIN:CHANNEL] Creating admin channel:",
          BROADCAST_CHANNEL_NAME,
        );
      }
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
        broadcastChannelRef.current = null;
      }

      currentChannel = supabase
        .channel(BROADCAST_CHANNEL_NAME)
        .subscribe((status) => {
          if (DEBUG_MODE) {
            console.log("[ADMIN:CHANNEL] Status:", status);
          }
          if (status === "SUBSCRIBED") {
            broadcastChannelRef.current = currentChannel;
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            console.warn(
              `Admin broadcast channel ${status}, retrying in 3s...`,
            );
            broadcastChannelRef.current = null;
            retryTimeout = setTimeout(setupChannel, 3000);
          }
        });
    };

    setupChannel();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      // currentChannel always holds the latest reference — no null-before-remove bug
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        currentChannel = null;
      }
      broadcastChannelRef.current = null;
    };
  }, [isPlayerReady, user, safeTimeout]);

  const handlePlay = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;

      if (DEBUG_MODE) console.log("[ADMIN:CONTROL] ▶️ Play clicked");
      await updateBroadcastState({
        is_playing: true,
        current_position: currentTime,
      });

      safeTimeout(() => {
        const playPromise = plyrRef.current?.plyr?.play();
        if (playPromise instanceof Promise) {
          playPromise.catch((err) => {
            console.error("Video play failed in handlePlay:", err);
            toast.error("Failed to play video - please try again", {
              icon: "⚠️",
              duration: 3000,
            });
          });
        }
      }, 100);

      toast.success("Broadcast started", { icon: "▶️" });
    } catch (err) {
      console.error("Failed to start broadcast:", err);
      toast.error("Failed to start broadcast");
    }
  };

  const handlePause = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentPosition = plyrRef.current.plyr.currentTime;
      if (DEBUG_MODE) console.log("[ADMIN:CONTROL] ⏸️ Pause clicked");
      plyrRef.current.plyr.pause();

      await updateBroadcastState({
        is_playing: false,
        current_position: currentPosition,
      });

      toast.success("Broadcast paused", { icon: "⏸️" });
    } catch {
      toast.error("Failed to pause broadcast");
    }
  };

  const handleSeek = async (seconds: number) => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      if (DEBUG_MODE)
        console.log("[ADMIN:CONTROL] ⏭️ Seek to", seconds, "seconds");
      plyrRef.current.plyr.currentTime = seconds;
      await updateBroadcastState({ current_position: seconds });
    } catch {
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
      await handleSeek(currentTime + 10);
      toast("Skipped forward 10 seconds", { icon: "⏩" });
    } catch {
      toast.error("Failed to skip forward");
    }
  };

  const handleSkipBackward = async () => {
    if (!isPlayerReady || !plyrRef.current?.plyr) return;

    try {
      const currentTime = plyrRef.current.plyr.currentTime;
      await handleSeek(Math.max(0, currentTime - 10));
      toast("Skipped backward 10 seconds", {
        icon: "⏪",
      });
    } catch {
      toast.error("Failed to skip backward");
    }
  };

  return (
    <div className="pt-16 bg-black min-h-screen overflow-hidden">
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-neutral-900 border border-neutral-700 p-3 sm:p-4 mb-3 sm:mb-4 rounded-lg"
        >
          <h2 className="text-white text-lg sm:text-xl font-bold mb-3 sm:mb-4">
            Admin Controls
          </h2>

          <VideoControls
            isPlayerReady={isPlayerReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onRestart={handleRestart}
            onSkipBackward={handleSkipBackward}
            onSkipForward={handleSkipForward}
            onShowQR={() => setShowQRModal(true)}
          />

          <BroadcastStatus broadcastState={broadcastState} />
        </motion.div>

        <VideoPlayer
          videoSrc={videoSrc}
          videoOptions={videoOptions}
          plyrRef={plyrRef}
          isPlayerReady={isPlayerReady}
        />
      </div>

      <QRCodeModal
        showQRModal={showQRModal}
        onClose={() => setShowQRModal(false)}
      />
    </div>
  );
};

export default AdminPanel;
