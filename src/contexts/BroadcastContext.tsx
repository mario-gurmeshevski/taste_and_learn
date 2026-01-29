import { createContext, type ReactNode, useCallback } from "react";
import { useBroadcastState } from "../hooks/useBroadcastState";
import type { BroadcastState } from "../config/types";

export interface BroadcastContextValue {
  broadcastState: BroadcastState | null;
  isSubscribed: boolean;
  error: Error | null;
}

const BroadcastContext = createContext<BroadcastContextValue | undefined>(
  undefined,
);

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
  const handleBroadcastError = useCallback((error: Error) => {
    console.error("Broadcast error:", error);
  }, []);

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
