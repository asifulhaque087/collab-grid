"use client";

import { useRef, useCallback } from "react";

export function useThrottle<T extends (...args: any[]) => any>(callback: T, delay: number) {
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (now - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = now;
      } else {
        // Guarantees that the final position at the end of a drag event isn't lost
        timeoutRef.current = setTimeout(
          () => {
            callback(...args);
            lastRan.current = Date.now();
          },
          delay - (now - lastRan.current),
        );
      }
    },
    [callback, delay],
  );
}
