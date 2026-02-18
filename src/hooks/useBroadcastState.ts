import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../lib/supabase";
import type { BroadcastState } from "../config/types";
import {
  POLLING_INTERVAL,
  BROADCAST_CHANNEL_NAME,
  SUBSCRIPTION_TIMEOUT,
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
  const mountedRef = useRef(true);
  const isSubscribedRef = useRef(false);

  const errorCallbackRef = useRef(onBroadcastError);
  useEffect(() => {
    errorCallbackRef.current = onBroadcastError;
  }, [onBroadcastError]);

  const fetchState = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const { data, error: fetchError } = await supabase
        .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
        .select("*")
        .maybeSingle();

      if (!mountedRef.current) return;

      if (data) {
        setBroadcastState(data);
        setError(null);
      } else if (fetchError) {
        const err = new Error(fetchError.message);
        setError(err);
        errorCallbackRef.current?.(err);
      }
    } catch (err) {
      console.error("Polling error in useBroadcastState:", err);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    // Don't start polling if already polling or if broadcast is active
    if (pollingIntervalRef.current) return;
    pollingIntervalRef.current = setInterval(
      fetchState,
      POLLING_INTERVAL,
    );
  }, [fetchState]);

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    isSubscribedRef.current = false;

    fetchState();

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    channelRef.current = supabase
      .channel(BROADCAST_CHANNEL_NAME)
      .on(
        "broadcast",
        { event: "broadcast-state-update" },
        (payload) => {
          if (!mountedRef.current) return;
          const newState = payload.payload as BroadcastState;
          setBroadcastState(newState);
          setError(null);
        },
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
          setIsSubscribed(true);

          // Cancel the fallback timeout — we're connected
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }

          // Keep a slow background poll as a safety net for missed broadcasts
          // (e.g. the client was briefly disconnected and re-subscribed)
          stopPolling();
          startPolling();
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          console.warn(`Broadcast channel ${status}, polling only`);
          isSubscribedRef.current = false;
          setIsSubscribed(false);
          startPolling();

          // Retry the WebSocket connection after 5s
          setTimeout(() => {
            if (!mountedRef.current) return;
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            // Re-running the effect by re-subscribing manually isn't possible,
            // so just let Supabase's built-in reconnect handle it
            supabase.realtime.connect();
          }, 5000);
        } else if (status === "CLOSED") {
          console.warn("Broadcast channel closed, polling only");
          isSubscribedRef.current = false;
          setIsSubscribed(false);
          startPolling();
        }
      });

    subscriptionTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current || isSubscribedRef.current) return;
      console.warn("Subscription timeout — falling back to polling");
      startPolling();
    }, SUBSCRIPTION_TIMEOUT);

    return () => {
      mountedRef.current = false;
      isSubscribedRef.current = false;

      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      stopPolling();

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setIsSubscribed(false);
    };
  }, [enabled, fetchState, startPolling, stopPolling]);

  return { broadcastState, isSubscribed, error };
}
