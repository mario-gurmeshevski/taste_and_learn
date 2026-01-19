import React, { useState, useRef, useEffect } from "react";
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

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

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
      console.log("Broadcast state updated:", broadcastState);
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
        console.log(
          `Syncing: drift=${timeDiff.toFixed(2)}s, expected=${expectedPosition.toFixed(2)}s`,
        );
        isUpdatingFromBroadcast.current = true;
        player.currentTime = expectedPosition;

        setTimeout(() => {
          isUpdatingFromBroadcast.current = false;
        }, 200);
      }

      // Sync play/pause state
      if (lastKnownState.isPlaying && player.paused) {
        console.log("Starting playback (was paused)");
        player.play().catch(console.error);
      } else if (!lastKnownState.isPlaying && !player.paused) {
        console.log("Pausing playback (was playing)");
        player.pause();
      }
    }, 1000);

    return () => clearInterval(syncInterval);
  }, [isPlayerReady, isLocallyPaused, lastKnownState]);

  // Initial fetch and realtime subscription
  useEffect(() => {
    if (!isPlayerReady) return;

    let channel: any;

    const setupSubscription = async () => {
      // Fetch initial state first
      const { data } = await supabase
        .from("public_broadcast_state")
        .select("*")
        .single();

      if (data && plyrRef.current?.plyr) {
        console.log("Initial broadcast state loaded:", data);
        setBroadcastState(data);
        plyrRef.current.plyr.currentTime = data.current_position;

        if (data.is_playing) {
          setTimeout(() => {
            plyrRef.current?.plyr.play().catch(console.error);
          }, 100);
        }
      }

      // Set up realtime subscription
      channel = supabase
        .channel("broadcast-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "public_broadcast_state",
          },
          (payload) => {
            console.log("Realtime update received:", payload.new);
            setBroadcastState(payload.new as BroadcastState);
          },
        )
        .subscribe((status) => {
          console.log("Subscription status:", status);
          if (status === "SUBSCRIBED") {
            setIsSubscribed(true);
            console.log(
              "Successfully subscribed to broadcast changes",
            );
          }
        });
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        setIsSubscribed(false);
      }
    };
  }, [isPlayerReady]);

  // Fallback polling if realtime isn't working
  useEffect(() => {
    if (!isPlayerReady || isSubscribed) return;

    console.log("Realtime not subscribed, using fallback polling...");

    const pollInterval = setInterval(async () => {
      const { data } = await supabase
        .from("public_broadcast_state")
        .select("*")
        .single();

      if (data) {
        console.log("Polling update:", data);
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

      console.log(
        `Resuming to live position: ${expectedPosition.toFixed(2)}s`,
      );
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
        <div className="text-center">
          <h2 className="text-white text-2xl mb-4">
            Admin User Detected
          </h2>
          <p className="text-neutral-400 mb-6">
            Please use the Admin Panel to control the broadcast
          </p>
          <a
            href="/admin"
            className="bg-neutral-900 text-white px-6 py-3 rounded hover:bg-neutral-800 transition-colors"
          >
            Go to Admin Panel
          </a>
        </div>
      </div>
    );
  }

  const videoSrc = {
    type: "video" as const,
    sources: [{ src: videoFile, type: "video/mp4" }],
  };

  return (
    <div className="pt-16 bg-black min-h-screen">
      <div className="max-w-7xl mx-auto p-6">
        {isLocallyPaused && (
          <div className="bg-yellow-900 border border-yellow-600 text-yellow-200 p-4 mb-4 rounded-lg">
            <p className="font-medium">
              ⏸ You've paused the stream locally
            </p>
            <p className="text-sm">
              Click "Resume to Live" to jump back to the admin's
              current broadcast position
            </p>
          </div>
        )}

        <div className="bg-blue-900 border border-blue-600 text-blue-200 p-4 mb-4 rounded-lg">
          <p className="font-medium text-sm">
            🔒 You are viewing a live broadcast controlled by the
            admin
          </p>
          <p className="text-xs mt-1">
            You can pause locally, but you cannot seek or control
            playback.{" "}
            {isSubscribed ? "🟢 Connected" : "🟡 Connecting..."}
          </p>
        </div>

        <div className="w-full h-[calc(100vh-16rem)]">
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
        </div>

        <div className="mt-4 flex justify-center gap-4">
          {!isLocallyPaused ? (
            <button
              onClick={handleLocalPause}
              disabled={!isPlayerReady}
              className={`${
                isPlayerReady
                  ? "bg-neutral-900 hover:bg-neutral-800"
                  : "bg-gray-500 cursor-not-allowed opacity-50"
              } text-white px-6 py-3 rounded text-sm font-medium transition-colors`}
            >
              ⏸ Pause Locally
            </button>
          ) : (
            <button
              onClick={handleLocalPlay}
              disabled={!isPlayerReady}
              className={`${
                isPlayerReady
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-500 cursor-not-allowed opacity-50"
              } text-white px-6 py-3 rounded text-sm font-medium transition-colors`}
            >
              ▶ Resume to Live
            </button>
          )}
        </div>

        <div className="mt-4 text-center text-neutral-400 text-sm">
          <p>
            Admin Broadcast Status:{" "}
            <span className="font-medium">
              {broadcastState?.is_playing ? "▶ Live" : "⏸ Paused"}
            </span>
          </p>
          <p>
            Current Position:{" "}
            <span className="font-medium">
              {(broadcastState?.current_position ?? 0).toFixed(2)}s
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
