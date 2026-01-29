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

/**
 * Custom hook for synchronizing video playback with broadcast state.
 *
 * Handles:
 * - Client-side interpolation for smooth playback
 * - Drift detection and correction
 * - Play/pause state synchronization
 *
 * @param options - Configuration options
 */
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

  // Client-side interpolation sync
  useEffect(() => {
    if (
      !enabled ||
      !playerRef.current?.plyr ||
      isLocallyPaused ||
      !lastKnownState
    ) {
      return;
    }

    const syncInterval = setInterval(() => {
      if (isUpdatingFromBroadcast) return;

      const player = playerRef.current?.plyr;
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
      if (timeDiff > MAX_DRIFT_TOLERANCE && !player.seeking) {
        setIsUpdatingFromBroadcast(true);
        player.currentTime = expectedPosition;

        setTimeout(() => {
          setIsUpdatingFromBroadcast(false);
        }, 200);
      }

      // Sync play/pause state
      if (lastKnownState.isPlaying && player.paused) {
        const playPromise = player.play();
        if (playPromise instanceof Promise) {
          playPromise.catch((error) => {
            console.error("Video play failed during sync:", error);
            // Don't show toast for frequent sync attempts to avoid spam
          });
        }
      } else if (!lastKnownState.isPlaying && !player.paused) {
        player.pause();
      }
    }, VIDEO_SYNC_INTERVAL);

    return () => clearInterval(syncInterval);
  }, [
    enabled,
    isLocallyPaused,
    lastKnownState,
    playerRef,
    isUpdatingFromBroadcast,
  ]);

  return {
    lastKnownState,
    isUpdatingFromBroadcast,
  };
}

/**
 * Hook for manually syncing video player to broadcast state.
 * Useful for initial sync and resume operations.
 */
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
