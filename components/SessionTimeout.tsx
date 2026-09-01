"use client";

import { useSessionTimeout } from "@/lib/hooks/useSessionTimeout";

export default function SessionTimeout() {
  useSessionTimeout();
  return null;
}
