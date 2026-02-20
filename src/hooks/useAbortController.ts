import { useEffect, useRef, useCallback } from "react";

export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const ifNotAborted = useCallback((callback: () => void) => {
    return () => {
      if (!abortControllerRef.current?.signal.aborted) {
        callback();
      }
    };
  }, []);

  const safeTimeout = useCallback(
    (callback: () => void, delay: number): (() => void) => {
      const timeoutId = setTimeout(ifNotAborted(callback), delay);

      return () => clearTimeout(timeoutId);
    },
    [ifNotAborted],
  );

  const safeInterval = useCallback(
    (callback: () => void, delay: number): (() => void) => {
      const intervalId = setInterval(ifNotAborted(callback), delay);

      return () => clearInterval(intervalId);
    },
    [ifNotAborted],
  );

  return {
    safeTimeout,
    safeInterval,
  };
}
