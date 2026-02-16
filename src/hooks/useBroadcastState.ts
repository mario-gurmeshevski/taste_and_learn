import { useState, useEffect, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../lib/supabase";
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

export function useBroadcastState(
  options: UseBroadcastStateOptions = {},
) {
  const { enabled = true, onBroadcastError } = options;

  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollingIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const subscriptionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const errorCallbackRef = useRef(onBroadcastError);
  useEffect(() => {
    errorCallbackRef.current = onBroadcastError;
  }, [onBroadcastError]);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    const startPolling = () => {
      if (pollingIntervalRef.current) return; // Already polling

      pollingIntervalRef.current = setInterval(async () => {
        if (!mounted) return;

        try {
          const { data } = await supabase
            .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
            .select("*")
            .maybeSingle();

          if (data && mounted) {
            setBroadcastState(data);
            setError(null);
          }
        } catch (err) {
          console.error("Polling error in useBroadcastState:", err);
        }
      }, POLLING_INTERVAL);
    };

    const cleanup = () => {
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
      stopPolling();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    // Fetch initial state
    supabase
      .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
      .select("*")
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (mounted) {
          if (data) {
            setBroadcastState(data);
            setError(null);
          } else if (fetchError) {
            console.error("Initial fetch error:", fetchError);
            const err = new Error(fetchError.message);
            setError(err);
            errorCallbackRef.current?.(err);
          }
        }
      });

    // Start subscription timeout - fallback to polling if not subscribed in time
    subscriptionTimeoutRef.current = setTimeout(() => {
      if (mounted && !isSubscribed) {
        console.warn("Subscription timeout, falling back to polling");
        startPolling();
      }
    }, POLLING_INTERVAL);

    // Setup subscription - check if channel already exists to prevent duplicates
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(BROADCAST_CHANNEL_NAME)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: DB_TABLES.PUBLIC_BROADCAST_STATE,
        },
        (payload) => {
          if (!mounted) return;
          const newState = payload.new as BroadcastState;
          setBroadcastState(newState);
          setError(null);
        },
      )
      .on(
        "broadcast",
        { event: "broadcast-state-update" },
        (payload) => {
          if (!mounted) return;
          const newState = payload.payload as BroadcastState;
          setBroadcastState(newState);
          setError(null);
        },
      )
      .subscribe((status) => {
        if (!mounted) return;

        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
          // Cancel fallback timeout and stop polling
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }
          stopPolling();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.error(
            `Subscription ${status}, falling back to polling`,
          );
          startPolling();
        } else if (status === "CLOSED") {
          // Channel closed unexpectedly - restart polling
          console.warn("Channel closed, falling back to polling");
          setIsSubscribed(false);
          startPolling();
        }
      });

    return () => {
      mounted = false;
      cleanup();
      setIsSubscribed(false);
    };
  }, [enabled]);

  return { broadcastState, isSubscribed, error };
}
