import { useCallback } from "react";
import toast from "react-hot-toast";
import type { PlyrRef } from "../config/types";
import { MS_TO_SECONDS } from "../config/constants";

interface VideoSyncState {
  position: number;
  timestamp: number;
  isPlaying: boolean;
}

export function useVideoSyncManual() {
  const syncToPosition = useCallback(
    (player: PlyrRef["plyr"], targetState: VideoSyncState): void => {
      if (!player) return;

      const now = Date.now();
      const timeElapsed =
        (now - targetState.timestamp) / MS_TO_SECONDS;
      const expectedPosition = targetState.isPlaying
        ? targetState.position + timeElapsed
        : targetState.position;

      player.currentTime = expectedPosition;

      if (targetState.isPlaying) {
        setTimeout(() => {
          const playPromise = player.play();
          if (playPromise instanceof Promise) {
            playPromise.catch((error) => {
              console.error(
                "Video play failed in manual sync:",
                error,
              );
              toast.error("Failed to play video - please try again", {
                icon: "⚠️",
                duration: 3000,
              });
            });
          }
        }, 100);
      } else {
        player.pause();
      }
    },
    [],
  );

  return { syncToPosition };
}
