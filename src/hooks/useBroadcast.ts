import { useContext } from "react";
import { BroadcastContext } from "../contexts/BroadcastContext";

/**
 * Hook to access the broadcast state from any component.
 *
 * @example
 * const { broadcastState, isSubscribed } = useBroadcast();
 */
export function useBroadcast() {
  const context = useContext(BroadcastContext);
  if (context === undefined) {
    throw new Error("useBroadcast must be used within a BroadcastProvider");
  }
  return context;
}
