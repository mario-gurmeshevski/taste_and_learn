import React, {
  useState,
  useRef,
  useEffect,
  lazy,
  Suspense,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaLock,
  FaPlay,
  FaPause,
  FaBroadcastTower,
} from "react-icons/fa";
import toast from "react-hot-toast";
import { useBroadcast } from "../hooks/useBroadcast";
import { useVideoSyncManual } from "../hooks/useVideoSync";
import { useAuth } from "../hooks/useAuth";
import "plyr-react/plyr.css";
import type { PlyrRef } from "../config/types";
import { VideoPlayerSkeleton } from "./Skeleton";
import { DEBUG_MODE, MS_TO_SECONDS } from "../config/constants";

const Plyr = lazy(() =>
  import("plyr-react").then((module) => ({ default: module.Plyr })),
);

const Home: React.FC = () => {
  if (DEBUG_MODE)
    console.log("[HOME:COMPONENT] Home component mounted");

  const { broadcastState, isSubscribed } = useBroadcast();
  const { syncToPosition } = useVideoSyncManual();
  const { isAdmin } = useAuth();

  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const plyrRef = useRef<PlyrRef>(null);

  // Log broadcast state changes
  useEffect(() => {
    if (DEBUG_MODE && broadcastState) {
      console.log("[HOME:STATE] Broadcast state changed:", {
        isPlaying: broadcastState.is_playing,
        position: broadcastState.current_position.toFixed(2),
        updatedAt: broadcastState.updated_at,
      });
    }
  }, [broadcastState]);

  // Log subscription status changes
  useEffect(() => {
    if (DEBUG_MODE) {
      console.log(
        "[HOME:SUBSCRIPTION] Status:",
        isSubscribed ? "✅ Connected" : "⚠️ Connecting/Disconnected",
      );
    }
  }, [isSubscribed]);

  // Derive lastKnownState from broadcastState
  const lastKnownState = useMemo(() => {
    if (!broadcastState) {
      return null;
    }
    return {
      position: broadcastState.current_position,
      timestamp: new Date(broadcastState.updated_at).getTime(),
      isPlaying: broadcastState.is_playing,
    };
  }, [broadcastState]);

  // Check if player is ready
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkReady = () => {
      if (!mounted) return;

      if (plyrRef.current?.plyr) {
        setIsPlayerReady(true);
        if (DEBUG_MODE)
          console.log("[HOME:PLAYER] Video player ready");
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

  // Initial sync to broadcast state
  useEffect(() => {
    if (
      !isPlayerReady ||
      !broadcastState ||
      !plyrRef.current?.plyr ||
      isLocallyPaused
    )
      return;

    syncToPosition(plyrRef.current.plyr, {
      position: broadcastState.current_position,
      timestamp: new Date(broadcastState.updated_at).getTime(),
      isPlaying: broadcastState.is_playing,
    });
  }, [
    isPlayerReady,
    broadcastState,
    syncToPosition,
    isLocallyPaused,
  ]);

  // Client-side interpolation sync
  useEffect(() => {
    if (
      !isPlayerReady ||
      !plyrRef.current?.plyr ||
      isLocallyPaused ||
      !lastKnownState
    )
      return;

    const syncInterval = setInterval(() => {
      const player = plyrRef.current?.plyr;
      if (!player) return;

      // Calculate expected position based on time elapsed
      const now = Date.now();
      const timeElapsed =
        (now - lastKnownState.timestamp) / MS_TO_SECONDS;
      const expectedPosition = lastKnownState.isPlaying
        ? lastKnownState.position + timeElapsed
        : lastKnownState.position;

      const currentTime = player.currentTime || 0;
      const timeDiff = Math.abs(expectedPosition - currentTime);

      // Only sync if drift exceeds tolerance
      if (timeDiff > 0.5 && !player.seeking) {
        if (DEBUG_MODE) {
          console.log("[HOME:DRIFT] Correcting drift:", {
            currentTime: currentTime.toFixed(2),
            expectedPosition: expectedPosition.toFixed(2),
            drift: timeDiff.toFixed(2),
          });
        }
        player.currentTime = expectedPosition;
      }

      // Sync play/pause state
      if (lastKnownState.isPlaying && player.paused) {
        if (DEBUG_MODE)
          console.log("[HOME:SYNC] Auto-playing to match broadcast");
        const playPromise = player.play();
        if (playPromise instanceof Promise) {
          playPromise.catch((error) => {
            console.error("Video play failed during sync:", error);
            // Don't show toast for frequent sync attempts to avoid spam
          });
        }
      } else if (!lastKnownState.isPlaying && !player.paused) {
        if (DEBUG_MODE)
          console.log("[HOME:SYNC] Auto-pausing to match broadcast");
        player.pause();
      }
    }, 100);

    return () => clearInterval(syncInterval);
  }, [isPlayerReady, isLocallyPaused, lastKnownState]);

  const handleLocalPause = () => {
    if (plyrRef.current?.plyr && isPlayerReady) {
      plyrRef.current.plyr.pause();
      setIsLocallyPaused(true);
      toast("Video paused locally", { icon: "⏸️" });
    }
  };

  const handleLocalPlay = () => {
    if (
      isLocallyPaused &&
      lastKnownState &&
      plyrRef.current?.plyr &&
      isPlayerReady
    ) {
      syncToPosition(plyrRef.current.plyr, lastKnownState);
      setIsLocallyPaused(false);
      toast("Resumed to live broadcast", { icon: "▶️" });
    }
  };

  if (isAdmin) {
    return (
      <div className="pt-16 bg-black min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
          className="text-center"
        >
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white text-2xl mb-4"
          >
            Admin User Detected
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-neutral-400 mb-6"
          >
            Please use the Admin Panel to control the broadcast
          </motion.p>
          <motion.a
            href="/admin"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-block bg-neutral-900 text-white px-6 py-3 rounded hover:bg-neutral-800 transition-colors"
          >
            Go to Admin Panel
          </motion.a>
        </motion.div>
      </div>
    );
  }

  const videoSrc = {
    type: "video" as const,
    sources: [
      { src: import.meta.env.VITE_VIDEO_URL, type: "video/mp4" },
    ],
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="pt-16 bg-black min-h-screen"
    >
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6">
        <AnimatePresence>
          {isLocallyPaused && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-yellow-900 border border-yellow-600 text-yellow-200 p-3 sm:p-4 mb-3 sm:mb-4 rounded-lg overflow-hidden"
            >
              <p className="font-medium flex items-center gap-2 text-sm sm:text-base">
                <FaPause aria-hidden="true" /> You've paused the
                stream locally
              </p>
              <p className="text-xs sm:text-sm">
                Click "Resume to Live" to jump back to the admin's
                current broadcast position
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-blue-900 border border-blue-600 text-blue-200 p-3 sm:p-4 mb-3 sm:mb-4 rounded-lg"
        >
          <p className="font-medium text-xs sm:text-sm flex items-center gap-2">
            <FaLock aria-hidden="true" /> You are viewing a live
            broadcast controlled by the admin
          </p>
          <p className="text-xs mt-1">
            You can pause locally, but you cannot seek or control
            playback.
            <span className="inline-flex items-center gap-1">
              {isSubscribed ? (
                <>
                  <FaBroadcastTower
                    className="text-green-400"
                    aria-hidden="true"
                  />
                  Connected
                </>
              ) : (
                <>
                  <FaBroadcastTower
                    className="text-yellow-400"
                    aria-hidden="true"
                  />
                  Connecting...
                </>
              )}
            </span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full h-[calc(100vh-16rem)]"
        >
          <Suspense fallback={<VideoPlayerSkeleton />}>
            <Plyr
              ref={plyrRef}
              source={videoSrc}
              options={{
                controls: [],
                hideControls: true,
                clickToPlay: false,
                keyboard: { focused: false, global: false },
                seekTime: 0,
                disableContextMenu: true,
                resetOnEnd: false,
              }}
            />
          </Suspense>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-3 sm:mt-4 flex justify-center gap-2 sm:gap-4"
        >
          <AnimatePresence mode="wait">
            {!isLocallyPaused ? (
              <motion.button
                key="pause"
                onClick={handleLocalPause}
                disabled={!isPlayerReady}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Pause video locally"
                aria-describedby="pause-description"
                className={`${
                  isPlayerReady
                    ? "bg-neutral-900 hover:bg-neutral-800"
                    : "bg-gray-500 cursor-not-allowed opacity-50"
                } text-white px-4 sm:px-6 py-2 sm:py-3 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2`}
              >
                <FaPause className="text-sm sm:text-base" /> Pause
                Locally
              </motion.button>
            ) : (
              <motion.button
                key="resume"
                onClick={handleLocalPlay}
                disabled={!isPlayerReady}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Resume to live broadcast"
                aria-describedby="resume-description"
                className={`${
                  isPlayerReady
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-500 cursor-not-allowed opacity-50"
                } text-white px-4 sm:px-6 py-2 sm:py-3 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2`}
              >
                <FaPlay className="text-sm sm:text-base" /> Resume to
                Live
              </motion.button>
            )}
          </AnimatePresence>
          <span id="pause-description" className="sr-only">
            Pause the video locally while the broadcast continues
          </span>
          <span id="resume-description" className="sr-only">
            Resume video and sync to the live broadcast position
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 sm:mt-4 text-center text-neutral-400 text-xs sm:text-sm"
        >
          <motion.p
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-xs sm:text-sm"
          >
            Admin Broadcast Status:
            <span className="font-medium inline-flex items-center gap-1">
              {broadcastState?.is_playing ? (
                <>
                  <FaPlay aria-hidden="true" /> Live
                </>
              ) : (
                <>
                  <FaPause aria-hidden="true" /> Paused
                </>
              )}
            </span>
          </motion.p>
          <motion.p
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.7 }}
            className="text-xs sm:text-sm"
          >
            Current Position:
            <span className="font-medium">
              {(broadcastState?.current_position ?? 0).toFixed(2)}s
            </span>
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Home;
