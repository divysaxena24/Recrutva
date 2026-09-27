"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Maximize2,
  Monitor,
  Eye,
  Lock,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SecureRoundConfig, ViolationType } from "@/lib/assessment-security";

export interface SecureAssessmentShellProps {
  candidateRoundId: number;
  roundTitle: string;
  config: SecureRoundConfig;
  initialViolationCount?: number;
  initialTerminated?: boolean;
  onSessionTerminated?: () => void;
  onTimeExpired?: () => void;
  onAutoSubmit?: () => void;
  children: React.ReactNode;
}

type ShellPhase = "precheck" | "fullscreen_prompt" | "active" | "warning" | "terminated";

export function SecureAssessmentShell({
  candidateRoundId,
  roundTitle,
  config,
  initialViolationCount = 0,
  initialTerminated = false,
  onSessionTerminated,
  onTimeExpired,
  onAutoSubmit,
  children,
}: SecureAssessmentShellProps) {
  const secureMode = config.secureMode ?? true;
  const requireFullscreen = config.requireFullscreen ?? true;
  const maxViolations = config.maxViolations ?? 3;
  const durationMinutes = config.durationMinutes ?? 45;

  // ─── State ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<ShellPhase>(
    initialTerminated ? "terminated" : secureMode ? "precheck" : "active"
  );

  const phaseRef = useRef<ShellPhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Keep fresh callback refs for async execution without triggering render-phase setState warnings
  const onSessionTerminatedRef = useRef(onSessionTerminated);
  const onTimeExpiredRef = useRef(onTimeExpired);
  const onAutoSubmitRef = useRef(onAutoSubmit);

  useEffect(() => {
    onSessionTerminatedRef.current = onSessionTerminated;
    onTimeExpiredRef.current = onTimeExpired;
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onSessionTerminated, onTimeExpired, onAutoSubmit]);

  // Environment issues check
  const getInitialEnvIssues = (): string[] => {
    const issues: string[] = [];
    if (typeof document !== "undefined") {
      const fullscreenSupported = Boolean(
        document.fullscreenEnabled ||
          (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
      );
      if (requireFullscreen && !fullscreenSupported) {
        issues.push("Fullscreen API is not supported by your current browser.");
      }
      if (!("visibilityState" in document)) {
        issues.push("Page Visibility API is not supported by your browser.");
      }
    }
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      issues.push("Screen width is too small. Please use a desktop or tablet device.");
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      issues.push("No active internet connection detected.");
    }
    return issues;
  };

  const [envIssues] = useState<string[]>(getInitialEnvIssues);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  const [violationCount, setViolationCount] = useState(initialViolationCount);
  const violationCountRef = useRef(initialViolationCount);

  const [isTerminated, setIsTerminated] = useState(initialTerminated);
  const [lastViolationType, setLastViolationType] = useState<ViolationType | null>(null);

  // Timer state (seconds left)
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(durationMinutes * 60);

  // Event deduplication tracking
  const lastViolationTimestampRef = useRef<number>(0);
  const lastRecordedTypeRef = useRef<string>("");

  // ─── Record Violation Handler (Local-First + Server Sync) ─────────
  const reportViolationToServer = useCallback(
    async (type: ViolationType, metadata: Record<string, unknown> = {}) => {
      const now = Date.now();
      const timeSinceLast = now - lastViolationTimestampRef.current;

      // Deduplicate rapid repeat events within 2000ms
      if (timeSinceLast < 2000 && lastRecordedTypeRef.current === type) {
        return;
      }

      lastViolationTimestampRef.current = now;
      lastRecordedTypeRef.current = type;

      const newCount = violationCountRef.current + 1;
      violationCountRef.current = newCount;

      setViolationCount(newCount);
      setLastViolationType(type);

      const isOverLimit = newCount >= maxViolations || type === "SESSION_TIMEOUT";

      if (isOverLimit) {
        setIsTerminated(true);
        setPhase("terminated");

        // Defer parent state mutation out of current render execution stack
        setTimeout(() => {
          if (onSessionTerminatedRef.current) onSessionTerminatedRef.current();
          if (onAutoSubmitRef.current) onAutoSubmitRef.current();
        }, 0);
      } else {
        setPhase("warning");
      }

      // Background server sync
      const eventId = `evt_${now}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        await fetch("/api/assessment/session/violation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            candidateRoundId,
            eventId,
            type,
            metadata,
          }),
        });
      } catch (err) {
        console.warn("[Proctoring] Server sync warning:", err);
      }
    },
    [candidateRoundId, maxViolations]
  );

  // ─── Fullscreen & Visibility Event Listeners ─────────────────────
  useEffect(() => {
    if (!secureMode) return;

    const handleFullscreenChange = () => {
      if (phaseRef.current !== "active") return;
      const isFullscreenNow = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
      );

      if (!isFullscreenNow && requireFullscreen) {
        reportViolationToServer("FULLSCREEN_EXIT", {
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
        });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "active") {
        reportViolationToServer("TAB_SWITCH", {
          visibilityState: document.visibilityState,
        });
      }
    };

    const handleWindowBlur = () => {
      if (phaseRef.current === "active") {
        reportViolationToServer("WINDOW_BLUR", {
          activeElement: document.activeElement?.tagName,
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [secureMode, requireFullscreen, reportViolationToServer]);

  // ─── Countdown Timer & Auto-Submit Handler ───────────────────────
  const hasTriggeredTimeoutRef = useRef(false);

  useEffect(() => {
    if (phase !== "active") return;

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!hasTriggeredTimeoutRef.current) {
            hasTriggeredTimeoutRef.current = true;
            console.log("[Timer] Assessment duration expired. Triggering auto-submit...");

            setTimeout(() => {
              if (onTimeExpiredRef.current) onTimeExpiredRef.current();
            }, 0);

            reportViolationToServer("SESSION_TIMEOUT");
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, reportViolationToServer]);

  // ─── Fullscreen Control ──────────────────────────────────────────
  const startSecureSession = async () => {
    setFullscreenError(null);

    if (requireFullscreen) {
      try {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
          await (elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
        }
        setPhase("active");
      } catch (err) {
        console.error("Fullscreen error:", err);
        setFullscreenError(
          "Fullscreen permission is required to begin this assessment. Please allow fullscreen and click Try Again."
        );
        setPhase("fullscreen_prompt");
      }
    } else {
      setPhase("active");
    }
  };

  const returnToFullscreen = async () => {
    if (requireFullscreen) {
      try {
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
          if (elem.requestFullscreen) {
            await elem.requestFullscreen();
          } else if ((elem as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
            await (elem as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
          }
        }
        setPhase("active");
      } catch {
        setPhase("active");
      }
    } else {
      setPhase("active");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // ─── Render: Terminated State ─────────────────────────────────────
  if (phase === "terminated" || isTerminated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6 font-sans">
        <Card className="max-w-lg w-full bg-slate-800 border-rose-500/30 p-8 rounded-3xl text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto">
            <XCircle className="w-10 h-10 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">Assessment Ended & Auto-Submitted</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your assessment session was completed or terminated due to security rules/timeout. Your responses up to this point have been automatically recorded and submitted.
            </p>
          </div>
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 text-xs text-slate-300 font-mono space-y-1">
            <div>Status: <span className="text-rose-400 font-bold">SUBMITTED</span></div>
            <div>Violations Recorded: <span className="text-rose-400 font-bold">{violationCount} / {maxViolations}</span></div>
            <div>Time Remaining: <span className="text-amber-400 font-bold">{formatTime(timeLeftSeconds)}</span></div>
          </div>
          <p className="text-xs text-slate-500">
            You may close this browser tab or return to your candidate portal.
          </p>
        </Card>
      </div>
    );
  }

  // ─── Render: Pre-Check Screen ────────────────────────────────────
  if (phase === "precheck" || phase === "fullscreen_prompt") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] opacity-30 pointer-events-none blur-[120px] bg-indigo-200 rounded-full" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full space-y-8 relative z-10"
        >
          <div className="text-center space-y-3">
            <Badge variant="outline" className="px-4 py-1.5 rounded-full border-indigo-200 bg-indigo-50 text-indigo-700 font-bold uppercase text-[10px] tracking-widest shadow-xs">
              <Shield className="w-3.5 h-3.5 mr-1.5 text-indigo-600 inline" /> Timed & Secure Assessment Environment
            </Badge>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {roundTitle}
            </h1>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Please review the environment rules and system check. Timer will start as soon as you click Start Assessment.
            </p>
          </div>

          <Card className="bg-white border-slate-200/80 p-8 rounded-3xl shadow-xs space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" /> Environment & Timer Rules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700 font-medium">
              <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <span>Timer: <strong>{durationMinutes} Minutes</strong> (Auto-submits on 0:00)</span>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <Maximize2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <span>Fullscreen mode is required</span>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <Monitor className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <span>Desktop browser recommended</span>
              </div>
              <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                <Eye className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <span>Tab switching or exiting fullscreen is recorded as a violation</span>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-900">
              <span className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> Security Violation Limit:
              </span>
              <Badge className="bg-amber-100 text-amber-800 font-bold border-amber-300">
                Max {maxViolations} Violations
              </Badge>
            </div>

            <div className="pt-2 border-t border-slate-100">
              {envIssues.length === 0 ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Environment Ready ✓
                </div>
              ) : (
                <div className="space-y-2 bg-rose-50 border border-rose-200 p-4 rounded-2xl">
                  <div className="text-xs font-bold text-rose-700 uppercase flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Environment Issue
                  </div>
                  {envIssues.map((issue, idx) => (
                    <p key={idx} className="text-xs text-rose-600 font-medium">
                      • {issue}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {fullscreenError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium">
                {fullscreenError}
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={startSecureSession}
                disabled={envIssues.length > 0}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-md shadow-indigo-600/15 cursor-pointer"
              >
                {fullscreenError ? "Try Again" : "Start Assessment"}
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ─── Render: Active Secure Shell ──────────────────────────────────
  const isTimeLow = timeLeftSeconds <= 300; // < 5 mins

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans select-none">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
            R
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">{roundTitle}</h2>
            <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold uppercase tracking-wider mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Proctoring & Violation Monitoring Active
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Countdown Timer */}
          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold border transition-all ${
              isTimeLow
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse"
                : "bg-slate-800 border-slate-700 text-amber-400"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Time Left: {formatTime(timeLeftSeconds)}
          </div>

          {/* Violation Counter Badge */}
          <Badge
            variant="outline"
            className={
              violationCount > 0
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400 text-xs font-bold px-3 py-1"
                : "bg-slate-800 border-slate-700 text-slate-300 text-xs font-bold px-3 py-1"
            }
          >
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Violations: {violationCount} / {maxViolations}
          </Badge>
        </div>
      </header>

      {/* Security Violation Warning Modal Overlay */}
      <AnimatePresence>
        {phase === "warning" && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-white border border-amber-200 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">⚠ Security Violation Detected</h3>
                <p className="text-sm text-slate-600">
                  {lastViolationType === "FULLSCREEN_EXIT"
                    ? "You exited fullscreen mode."
                    : lastViolationType === "WINDOW_BLUR"
                    ? "Focus moved away from the assessment window."
                    : "You switched tabs or minimized the window."}{" "}
                  This event has been logged to proctoring records.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm font-bold text-amber-900 flex items-center justify-between">
                <span>Violations Count:</span>
                <span className="text-amber-700 text-base">{violationCount} / {maxViolations}</span>
              </div>

              <p className="text-xs text-slate-500">
                Please return to fullscreen immediately. Exceeding {maxViolations} violations will automatically submit and lock your assessment.
              </p>

              <Button
                onClick={returnToFullscreen}
                className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md"
              >
                Return to Assessment
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 p-6 lg:p-10 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  );
}
