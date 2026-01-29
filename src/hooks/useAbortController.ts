import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook to manage AbortController for cleanup of async operations.
 * Automatically aborts on component unmount and provides utilities for safe async operations.
 *
 * @returns An object with abort signal and utility functions
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize AbortController on mount
  useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      // Abort all ongoing operations on unmount
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Checks if the operation has been aborted.
   */
  const isAborted = useCallback((): boolean => {
    return abortControllerRef.current?.signal.aborted ?? false;
  }, []);

  /**
   * Executes a callback only if not aborted.
   * Useful for setTimeout callbacks and event handlers.
   */
  const ifNotAborted = useCallback((callback: () => void) => {
    return () => {
      if (!isAborted()) {
        callback();
      }
    };
  }, [isAborted]);

  /**
   * Creates a timeout that automatically cleans up on abort or unmount.
   * Returns a cleanup function.
   */
  const safeTimeout = useCallback((
    callback: () => void,
    delay: number,
  ): (() => void) => {
    const timeoutId = setTimeout(ifNotAborted(callback), delay);

    return () => clearTimeout(timeoutId);
  }, [ifNotAborted]);

  /**
   * Creates an interval that automatically cleans up on abort or unmount.
   * Returns a cleanup function.
   */
  const safeInterval = useCallback((
    callback: () => void,
    delay: number,
  ): (() => void) => {
    const intervalId = setInterval(ifNotAborted(callback), delay);

    return () => clearInterval(intervalId);
  }, [ifNotAborted]);

  return {
    isAborted,
    ifNotAborted,
    safeTimeout,
    safeInterval,
  };
}
