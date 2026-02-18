import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../lib/supabase";
import type { BroadcastState } from "../config/types";
import {
  DEBUG_MODE,
  POLLING_INTERVAL,
  POLLING_INTERVAL_BACKUP,
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

  if (DEBUG_MODE)
    console.log(
      "[BROADCAST:HOOK] Hook initialized - enabled:",
      enabled,
    );

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
        if (DEBUG_MODE)
          console.log("[BROADCAST:FETCH] Success:", data);
      } else if (fetchError) {
        const err = new Error(fetchError.message);
        setError(err);
        if (DEBUG_MODE)
          console.error(
            "[BROADCAST:FETCH] Error:",
            fetchError.message,
          );
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
    if (DEBUG_MODE) console.log("[BROADCAST:POLLING] Stopped");
  }, []);

  const startPolling = useCallback(
    (interval: number = POLLING_INTERVAL) => {
      // Don't start polling if already polling
      if (pollingIntervalRef.current) return;
      const intervalSeconds = interval / 1000;
      if (DEBUG_MODE)
        console.log(
          `[BROADCAST:POLLING] Started ${intervalSeconds}s interval`,
        );
      pollingIntervalRef.current = setInterval(fetchState, interval);
    },
    [fetchState],
  );

  useEffect(() => {
    if (!enabled) return;

    mountedRef.current = true;
    isSubscribedRef.current = false;

    if (DEBUG_MODE)
      console.log("[BROADCAST:FETCH] Initial fetch started");
    queueMicrotask(fetchState);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (DEBUG_MODE)
      console.log(
        "[BROADCAST:CHANNEL] Creating channel:",
        BROADCAST_CHANNEL_NAME,
      );

    channelRef.current = supabase
      .channel(BROADCAST_CHANNEL_NAME)
      // Fast path: manual broadcast sent by AdminPanel
      .on(
        "broadcast",
        { event: "broadcast-state-update" },
        (payload) => {
          if (!mountedRef.current) return;
          const newState = payload.payload as BroadcastState;
          setBroadcastState(newState);
          setError(null);
          if (DEBUG_MODE)
            console.log(
              "[BROADCAST:REALTIME] Received broadcast update:",
              newState,
            );
        },
      )
      // ✅ FIX: Reliable path — fires directly from the DB write.
      // Catches play/pause even if the manual broadcast message was missed
      // (e.g. channel not yet SUBSCRIBED when admin clicked play/pause).
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: DB_TABLES.PUBLIC_BROADCAST_STATE,
        },
        (payload) => {
          if (!mountedRef.current) return;
          const newState = payload.new as BroadcastState;
          setBroadcastState(newState);
          setError(null);
          if (DEBUG_MODE)
            console.log(
              "[BROADCAST:DB_CHANGE] Received DB update:",
              newState,
            );
        },
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;
        if (DEBUG_MODE)
          console.log("[BROADCAST:STATUS] Status changed:", status);

        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
          setIsSubscribed(true);
          if (DEBUG_MODE)
            console.log(
              "[BROADCAST:STATUS] SUBSCRIBED - Realtime connected",
            );
          // Cancel the fallback timeout — we're connected
          if (subscriptionTimeoutRef.current) {
            clearTimeout(subscriptionTimeoutRef.current);
            subscriptionTimeoutRef.current = null;
          }
          // Keep a slow background poll as a safety net for missed broadcasts
          // e.g. the client was briefly disconnected and re-subscribed
          stopPolling();
          startPolling(POLLING_INTERVAL_BACKUP);
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          if (DEBUG_MODE)
            console.warn(
              `[BROADCAST:STATUS] ${status} - Falling back to polling`,
            );
          console.warn(
            "Broadcast channel status, falling back to polling",
          );
          isSubscribedRef.current = false;
          setIsSubscribed(false);
          startPolling(POLLING_INTERVAL);
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
          if (DEBUG_MODE)
            console.warn("[BROADCAST:STATUS] CLOSED - Polling only");
          console.warn("Broadcast channel closed, polling only");
          isSubscribedRef.current = false;
          setIsSubscribed(false);
          startPolling(POLLING_INTERVAL);
        }
      });

    subscriptionTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current || isSubscribedRef.current) return;
      if (DEBUG_MODE)
        console.warn(
          "[BROADCAST:TIMEOUT] Subscription timeout 10s - Falling back to polling",
        );
      console.warn("Subscription timeout falling back to polling");
      startPolling(POLLING_INTERVAL);
    }, SUBSCRIPTION_TIMEOUT);

    return () => {
      if (DEBUG_MODE)
        console.log("[BROADCAST:HOOK] Cleaning up and unmounting");
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
