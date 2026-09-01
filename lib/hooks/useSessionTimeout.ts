"use client";

import { useEffect, useCallback, useRef } from "react";
import { useClerk } from "@clerk/nextjs";

const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
const STORAGE_KEY = "lastActivityTimestamp";

function getLastActivityTime(): number {
  if (typeof window === "undefined") return Date.now();
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : Date.now();
}

function setLastActivityTime(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, Date.now().toString());
}

export function useSessionTimeout() {
  const { signOut } = useClerk();
  const lastActivityRef = useRef<number>(getLastActivityTime());

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setLastActivityTime();
  }, []);

  useEffect(() => {
    // Initialize timestamp on mount
    setLastActivityTime();

    // Activity event listeners
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ] as const;

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Periodic inactivity check
    const interval = setInterval(() => {
      const now = Date.now();
      const lastActivity = getLastActivityTime();

      if (now - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        localStorage.removeItem(STORAGE_KEY);
        signOut({ redirectUrl: "/" });
      }
    }, ACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(interval);
    };
  }, [handleActivity, signOut]);
}
