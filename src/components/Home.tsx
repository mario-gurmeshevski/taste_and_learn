import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaLock,
  FaPlay,
  FaPause,
  FaBroadcastTower,
} from "react-icons/fa";
import supabase from "../lib/supabase";
import videoFile from "../assets/video.mp4";
import { Plyr } from "plyr-react";
import "plyr-react/plyr.css";
import type { BroadcastState, PlyrRef } from "../types";

const Home: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [isLocallyPaused, setIsLocallyPaused] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [lastKnownState, setLastKnownState] = useState<{
    position: number;
    timestamp: number;
    isPlaying: boolean;
  } | null>(null);

  const plyrRef = useRef<PlyrRef>(null);
  const isUpdatingFromBroadcast = useRef(false);
  const broadcastStateRef = useRef<BroadcastState | null>(null);

  // Check authentication and load user profile
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Set realtime auth for subscriptions
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      if (session?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();

        if (userData) {
          setCurrentUser(userData);
        }
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Update realtime auth when session changes
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }

        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (userData) {
            setCurrentUser(userData);
          }
        } else {
          setCurrentUser(null);
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Keep ref in sync
  useEffect(() => {
    broadcastStateRef.current = broadcastState;
  }, [broadcastState]);

  // Update lastKnownState when broadcast state changes
  useEffect(() => {
    if (broadcastState) {
      setLastKnownState({
        position: broadcastState.current_position,
        timestamp: new Date(broadcastState.updated_at).getTime(),
        isPlaying: broadcastState.is_playing,
      });
    }
  }, [broadcastState]);

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
      if (isUpdatingFromBroadcast.current) return;

      const player = plyrRef.current?.plyr;
      if (!player) return;

      // Calculate expected position based on time elapsed
      const now = Date.now();
      const timeElapsed = (now - lastKnownState.timestamp) / 1000;
      const expectedPosition = lastKnownState.isPlaying
        ? lastKnownState.position + timeElapsed
        : lastKnownState.position;

      const currentTime = player.currentTime || 0;
      const timeDiff = Math.abs(expectedPosition - currentTime);

      // Only sync if drift > 1 second
      if (timeDiff > 1.0 && !player.seeking) {
        isUpdatingFromBroadcast.current = true;
        player.currentTime = expectedPosition;

        setTimeout(() => {
          isUpdatingFromBroadcast.current = false;
        }, 200);
      }

      // Sync play/pause state
      if (lastKnownState.isPlaying && player.paused) {
        player.play().catch(console.error);
      } else if (!lastKnownState.isPlaying && !player.paused) {
        player.pause();
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [isPlayerReady, isLocallyPaused, lastKnownState]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (!isPlayerReady) return;

    let channel: any;
    let broadcastSubscribed = false;
    let fallbackTimeoutId: ReturnType<typeof setTimeout> | null =
      null;

    const setupSubscription = async () => {
      // Fetch initial state first
      const { data } = await supabase
        .from("public_broadcast_state")
        .select("*")
        .maybeSingle();

      if (data && plyrRef.current?.plyr) {
        setBroadcastState(data);
        plyrRef.current.plyr.currentTime = data.current_position;

        if (data.is_playing) {
          setTimeout(() => {
            plyrRef.current?.plyr.play().catch(console.error);
          }, 100);
        }
      }

      // Set up realtime broadcast subscription
      channel = supabase
        .channel("broadcast-sync") // Same channel name as Quiz and Admin
        .on(
          "broadcast",
          { event: "broadcast-state-update" },
          (payload) => {
            setBroadcastState(payload.payload as BroadcastState);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            broadcastSubscribed = true;
            setIsSubscribed(true);
            // Clear the fallback timeout
            if (fallbackTimeoutId) {
              clearTimeout(fallbackTimeoutId);
              fallbackTimeoutId = null;
            }
          }
        });

      // Fallback timeout - if not subscribed after 5 seconds, will use polling
      fallbackTimeoutId = setTimeout(() => {
        if (!broadcastSubscribed) {
          // Will use polling instead
        }
      }, 5000);
    };

    setupSubscription();

    return () => {
      if (fallbackTimeoutId) {
        clearTimeout(fallbackTimeoutId);
      }
      if (channel) {
        supabase.removeChannel(channel);
        setIsSubscribed(false);
      }
    };
  }, [isPlayerReady]);

  // Fallback polling if realtime isn't working
  useEffect(() => {
    if (!isPlayerReady || isSubscribed) return;

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("public_broadcast_state")
        .select("*")
        .maybeSingle();

      if (data) {
        setBroadcastState(data);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isPlayerReady, isSubscribed]);

  const handleLocalPause = () => {
    if (plyrRef.current?.plyr && isPlayerReady) {
      plyrRef.current.plyr.pause();
      setIsLocallyPaused(true);
    }
  };

  const handleLocalPlay = () => {
    if (
      isLocallyPaused &&
      lastKnownState &&
      plyrRef.current?.plyr &&
      isPlayerReady
    ) {
      // Calculate current expected position
      const now = Date.now();
      const timeElapsed = (now - lastKnownState.timestamp) / 1000;
      const expectedPosition = lastKnownState.isPlaying
        ? lastKnownState.position + timeElapsed
        : lastKnownState.position;

      plyrRef.current.plyr.currentTime = expectedPosition;
      setIsLocallyPaused(false);

      if (lastKnownState.isPlaying) {
        setTimeout(() => {
          plyrRef.current?.plyr.play().catch(console.error);
        }, 100);
      }
    }
  };

  if (currentUser?.role === "admin") {
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
    sources: [{ src: videoFile, type: "video/mp4" }],
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
                <FaPause /> You've paused the stream locally
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
            <FaLock /> You are viewing a live broadcast controlled by
            the admin
          </p>
          <p className="text-xs mt-1">
            You can pause locally, but you cannot seek or control
            playback.
            <span className="inline-flex items-center gap-1">
              {isSubscribed ? (
                <>
                  <FaBroadcastTower className="text-green-400" />
                  Connected
                </>
              ) : (
                <>
                  <FaBroadcastTower className="text-yellow-400" />
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
                className={`${
                  isPlayerReady
                    ? "bg-neutral-900 hover:bg-neutral-800"
                    : "bg-gray-500 cursor-not-allowed opacity-50"
                } text-white px-4 sm:px-6 py-2 sm:py-3 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2`}
              >
                <FaPause className="text-sm sm:text-base" /> Pause Locally
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
                className={`${
                  isPlayerReady
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-500 cursor-not-allowed opacity-50"
                } text-white px-4 sm:px-6 py-2 sm:py-3 rounded text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 sm:gap-2`}
              >
                <FaPlay className="text-sm sm:text-base" /> Resume to Live
              </motion.button>
            )}
          </AnimatePresence>
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
                  <FaPlay /> Live
                </>
              ) : (
                <>
                  <FaPause /> Paused
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
