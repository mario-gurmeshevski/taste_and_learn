import { createContext, type ReactNode, useCallback } from "react";
import { DEBUG_MODE } from "../config/constants";
import { useBroadcastState } from "../hooks/useBroadcastState";
import type { BroadcastState } from "../config/types";

export interface BroadcastContextValue {
  broadcastState: BroadcastState | null;
  isSubscribed: boolean;
  error: Error | null;
}

const BroadcastContext = createContext<
  BroadcastContextValue | undefined
>(undefined);

interface BroadcastProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

/**
 * Provider component that wraps the app to provide broadcast state globally.
 *
 * This eliminates duplicate state fetching and ensures all components
 * access the same broadcast state.
 */
export function BroadcastProvider({
  children,
  enabled = true,
}: BroadcastProviderProps) {
  if (DEBUG_MODE)
    console.log(
      "[BROADCAST:PROVIDER] BroadcastProvider initialized - enabled:",
      enabled,
    );

  const handleBroadcastError = useCallback((error: Error) => {
    if (DEBUG_MODE)
      console.error(
        "[BROADCAST:PROVIDER] Error callback invoked:",
        error,
      );
    console.error("Broadcast error:", error);
  }, []);

  if (DEBUG_MODE)
    console.log(
      "[BROADCAST:PROVIDER] Calling useBroadcastState hook",
    );
  const broadcastStateData = useBroadcastState({
    enabled,
    onBroadcastError: handleBroadcastError,
  });

  return (
    <BroadcastContext.Provider value={broadcastStateData}>
      {children}
    </BroadcastContext.Provider>
  );
}

export { BroadcastContext };
