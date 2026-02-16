import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import type { PlyrRef } from "../config/types";
import type { BroadcastState } from "../config/types";
import {
  VIDEO_SYNC_INTERVAL,
  MAX_DRIFT_TOLERANCE,
  MS_TO_SECONDS,
} from "../config/constants";

interface VideoSyncState {
  position: number;
  timestamp: number;
  isPlaying: boolean;
}

interface UseVideoSyncOptions {
  playerRef: React.RefObject<PlyrRef>;
  broadcastState: BroadcastState | null;
  enabled?: boolean;
  isLocallyPaused?: boolean;
}

export function useVideoSync(options: UseVideoSyncOptions) {
  const {
    playerRef,
    broadcastState,
    enabled = true,
    isLocallyPaused = false,
  } = options;

  const [isUpdatingFromBroadcast, setIsUpdatingFromBroadcast] =
    useState(false);

  // Memoized last known state for efficient comparisons
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

  useEffect(() => {
    if (
      !enabled ||
      !playerRef.current?.plyr ||
      isLocallyPaused ||
      !lastKnownState ||
      !lastKnownState.isPlaying
    ) {
      return;
    }

    const syncInterval = setInterval(() => {
      if (isUpdatingFromBroadcast) return;

      const player = playerRef.current?.plyr;
      if (!player) return;

      // Only runs when video is playing
      const now = Date.now();
      const timeElapsed =
        (now - lastKnownState.timestamp) / MS_TO_SECONDS;
      const expectedPosition = lastKnownState.position + timeElapsed;

      const currentTime = player.currentTime || 0;
      const timeDiff = Math.abs(expectedPosition - currentTime);

      if (timeDiff > MAX_DRIFT_TOLERANCE && !player.seeking) {
        setIsUpdatingFromBroadcast(true);
        player.currentTime = expectedPosition;
        setTimeout(() => setIsUpdatingFromBroadcast(false), 200);
      }
    }, VIDEO_SYNC_INTERVAL);

    return () => clearInterval(syncInterval);
  }, [
    enabled,
    isLocallyPaused,
    lastKnownState,
    playerRef,
    isUpdatingFromBroadcast,
  ]); // Dependencies include lastKnownState now

  return {
    lastKnownState,
    isUpdatingFromBroadcast,
  };
}

export function useVideoSyncManual() {
  const syncToPosition = (
    player: PlyrRef["plyr"],
    targetState: VideoSyncState,
  ): void => {
    if (!player) return;

    const now = Date.now();
    const timeElapsed = (now - targetState.timestamp) / MS_TO_SECONDS;
    const expectedPosition = targetState.isPlaying
      ? targetState.position + timeElapsed
      : targetState.position;

    player.currentTime = expectedPosition;

    if (targetState.isPlaying) {
      setTimeout(() => {
        const playPromise = player.play();
        if (playPromise instanceof Promise) {
          playPromise.catch((error) => {
            console.error("Video play failed in manual sync:", error);
            toast.error("Failed to play video - please try again", {
              icon: "⚠️",
              duration: 3000,
            });
          });
        }
      }, 100);
    }
  };

  return { syncToPosition };
}
