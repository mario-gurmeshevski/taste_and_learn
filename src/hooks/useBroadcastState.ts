import { useState, useEffect, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../lib/supabase";
import { useAbortController } from "./useAbortController";
import type { BroadcastState } from "../config/types";
import {
  POLLING_INTERVAL,
  BROADCAST_CHANNEL_NAME,
  DB_TABLES,
} from "../config/constants";

interface UseBroadcastStateOptions {
  enabled?: boolean;
  onBroadcastError?: (error: Error) => void;
}

interface UseBroadcastStateReturn {
  broadcastState: BroadcastState | null;
  isSubscribed: boolean;
  error: Error | null;
}

export function useBroadcastState(
  options: UseBroadcastStateOptions = {},
): UseBroadcastStateReturn {
  const { enabled = true, onBroadcastError } = options;
  const { isAborted, safeTimeout, safeInterval } =
    useAbortController();

  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const hasSuccessfullySubscribedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;
    let cleanupSubscriptionTimer: (() => void) | null = null;
    let cleanupPollInterval: (() => void) | null = null;

    const startPolling = () => {
      if (cleanupPollInterval) return; // Already polling

      cleanupPollInterval = safeInterval(async () => {
        if (isAborted()) return;

        try {
          const { data } = await supabase
            .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
            .select("*")
            .maybeSingle();

          if (data && !isAborted()) {
            setBroadcastState(data);
            setError(null);
          }
        } catch (err) {
          console.error("Polling error in useBroadcastState:", err);
          // Silently handle polling errors to avoid spamming the user
        }
      }, POLLING_INTERVAL);
    };

    const stopPolling = () => {
      if (cleanupPollInterval) {
        cleanupPollInterval();
        cleanupPollInterval = null;
      }
    };

    const initSubscription = async () => {
      if (isAborted()) return;

      try {
        // Fetch initial state
        const { data } = await supabase
          .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
          .select("*")
          .maybeSingle();

        if (data && !isAborted()) {
          setBroadcastState(data);
          setError(null);
        }

        // Start a timer for fallback to polling
        cleanupSubscriptionTimer = safeTimeout(() => {
          // Only start polling if we haven't successfully subscribed yet
          if (!hasSuccessfullySubscribedRef.current && !isAborted()) {
            console.error(
              "useBroadcastState: Subscription timeout, falling back to polling",
            );
            startPolling();
          }
        }, POLLING_INTERVAL);

        // Subscribe to both database changes AND broadcast messages
        channel = supabase
          .channel(BROADCAST_CHANNEL_NAME)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: DB_TABLES.PUBLIC_BROADCAST_STATE,
            },
            (payload) => {
              if (isAborted()) return;

              const newState = payload.new as BroadcastState;
              setBroadcastState(newState);
              setError(null);
            },
          )
          .on(
            "broadcast",
            { event: "broadcast-state-update" },
            (payload) => {
              if (isAborted()) return;

              const newState = payload.payload as BroadcastState;
              setBroadcastState(newState);
              setError(null);
            },
          )
          .subscribe((status) => {
            if (isAborted()) return;

            if (status === "SUBSCRIBED") {
              // Subscription succeeded - stop the timer and polling
              hasSuccessfullySubscribedRef.current = true;
              setIsSubscribed(true);
              if (cleanupSubscriptionTimer) {
                cleanupSubscriptionTimer();
                cleanupSubscriptionTimer = null;
              }
              stopPolling();
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT"
            ) {
              // Subscription failed - start polling immediately
              console.error(
                `useBroadcastState: Subscription ${status}, falling back to polling`,
              );
              startPolling();
            }
          });
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error(String(err));
        console.error(
          "Subscription initialization failed in useBroadcastState:",
          err,
        );
        setError(errorObj);
        onBroadcastError?.(errorObj);

        if (!isAborted()) {
          startPolling();
        }
      }
    };

    initSubscription();

    // Cleanup
    return () => {
      cleanupSubscriptionTimer?.();
      cleanupPollInterval?.();
      if (channel) {
        supabase.removeChannel(channel);
      }
      hasSuccessfullySubscribedRef.current = false; // Reset for potential remount
      setIsSubscribed(false);
    };
  }, [
    enabled,
    isAborted,
    safeTimeout,
    safeInterval,
    onBroadcastError,
  ]);

  return {
    broadcastState,
    isSubscribed,
    error,
  };
}
