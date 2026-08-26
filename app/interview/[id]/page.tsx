"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Mic,
  Calendar,
  Clock,
  ShieldCheck,
  ArrowRight,
  User,
  Sparkles,
  Video,
  MicOff,
  PhoneOff,
  Send,
  Loader2,
  ShieldAlert,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────
interface Message {
  role: "ai" | "user";
  content: string;
}

type InterviewStep =
  | "intro"
  | "waiting_permission"
  | "generating"
  | "asking"
  | "processing_answer"
  | "completing"
  | "completed"
  | "error"
  | "blocked";

type RecordingState = "idle" | "recording" | "transcribing" | "error";

const TOTAL_QUESTIONS = 10;
const QUESTION_DELAY_MS = 1500;
const GREETING_DELAY_MS = 2000;

// ─── Entry Component ──────────────────────────────────────────────
export default function InterviewPortal() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"join" | "interview">("join");
  const [name, setName] = useState("");
  const [step, setStep] = useState(1);
  const [isJoining, setIsJoining] = useState(false);
  const requestedView = searchParams.get("view");

  if (view === "join") {
    return (
      <InterviewJoinPage
        name={name}
        setName={setName}
        step={step}
        setStep={setStep}
        isJoining={isJoining}
        interviewId={params.id as string}
        requestedView={requestedView}
        onStart={() => {
          setIsJoining(true);
          setTimeout(() => {
            setView("interview");
            setIsJoining(false);
          }, 800);
        }}
      />
    );
  }

  return (
    <InterviewRoom
      name={name}
      interviewId={params.id as string}
    />
  );
}

// ─── Join Page Component ──────────────────────────────────────────
function InterviewJoinPage({
  name,
  setName,
  step,
  setStep,
  isJoining,
  onStart,
  interviewId,
  requestedView,
}: {
  name: string;
  setName: (n: string) => void;
  step: number;
  setStep: (s: number) => void;
  isJoining: boolean;
  onStart: () => void;
  interviewId: string;
  requestedView: string | null;
}) {
  const [candidate, setCandidate] = useState<{
    name: string;
    status: string;
    jobTitle: string;
    linkedJobTitle: string;
    analysis: Record<string, unknown>;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/candidate/${interviewId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.candidate) {
          setCandidate(data.candidate);
          setName(data.candidate.name);
        }
      });
  }, [interviewId, setName]);

  const handleNext = () => {
    if (step === 1) setStep(2);
    else onStart();
  };

  const displayJobTitle =
    candidate?.jobTitle || candidate?.linkedJobTitle || "Senior Developer";

  if (candidate?.status === "Completed") {
    if (requestedView === "summary") {
      return (
        <InterviewSummaryViewer
          analysis={candidate.analysis}
          name={candidate.name}
        />
      );
    }
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-white">
          Interview Already Completed
        </h2>
        <p className="text-slate-400 max-w-md">
          This interview has already been submitted and cannot be accessed
          again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button
            onClick={() =>
              router.push(`/interview/${interviewId}?view=summary`)
            }
            className="bg-emerald-600 hover:bg-emerald-500 rounded-2xl h-12 px-8 font-bold"
          >
            View Summary
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl h-12 px-8 font-bold"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] opacity-20 pointer-events-none blur-[120px] bg-indigo-500 rounded-full" />
      <div className="max-w-4xl w-full relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-3 mb-12"
        >
          <div className="bg-indigo-500/10 p-3 rounded-2xl ring-1 ring-indigo-500/30">
            <Bot className="w-8 h-8 text-indigo-400" />
          </div>
          <span className="font-bold text-2xl tracking-tight">
            Recrutva <span className="text-indigo-500">AI</span>
          </span>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-3 flex flex-col gap-6"
          >
            <Card className="flex-1 p-8 bg-slate-900/40 border-slate-800/60 backdrop-blur-xl rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col justify-between">
              <div className="space-y-6">
                <Badge
                  variant="outline"
                  className="px-4 py-1.5 rounded-full border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-bold uppercase text-[10px]"
                >
                  AI Screening Session
                </Badge>
                <div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                    {displayJobTitle} <br />
                    <span className="text-slate-400 text-2xl">
                      at Recrutva Partner
                    </span>
                  </h1>
                  <p className="text-slate-400 leading-relaxed max-w-md">
                    Join your AI-powered voice interview. Sarah will guide you
                    through technical and behavioral questions tailored to
                    your profile.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <InfoItem
                    icon={<Clock className="w-4 h-4 text-amber-400" />}
                    label="Duration"
                    value="~15-20 Mins"
                  />
                  <InfoItem
                    icon={<Calendar className="w-4 h-4 text-indigo-400" />}
                    label="Format"
                    value="AI Voice Call"
                  />
                </div>
              </div>
              <div className="pt-8 border-t border-slate-800/60 mt-8 text-emerald-400/80 text-sm font-bold uppercase tracking-widest flex items-center gap-3">
                <ShieldCheck className="w-5 h-5" /> Privacy Secured
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 flex flex-col"
          >
            <Card className="flex-1 p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col justify-center text-center space-y-8">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center mx-auto ring-1 ring-indigo-500/20">
                      <Sparkles className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                      Ready to start?
                    </h2>
                    <p className="text-sm text-slate-500">
                      Ensure you&apos;re in a quiet environment.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6 text-left"
                  >
                    <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase mb-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" /> Full
                      Name
                    </div>
                    <Input
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-14 bg-slate-950 border-slate-800 rounded-2xl pl-5 text-base"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <Button
                onClick={handleNext}
                disabled={isJoining || (step === 2 && !name.trim())}
                className="w-full h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg group"
              >
                {isJoining ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    {step === 1 ? "Next Step" : "Begin Interview"}{" "}
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─── Interview Room Component ─────────────────────────────────────
function InterviewRoom({
  name,
  interviewId,
}: {
  name: string;
  interviewId: string;
}) {
  // ══════════════════════════════════════════════════════════════
  // ALL STATE & REFS
  // ══════════════════════════════════════════════════════════════
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isAccessBlocked, setIsAccessBlocked] = useState(false);
  const [blockedCandidateName, setBlockedCandidateName] = useState(name);
  const [isFinished, setIsFinished] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null
  );
  const [questionNumber, setQuestionNumber] = useState(0);
  const [interviewStep, setInterviewStep] = useState<InterviewStep>("intro");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const interviewStepRef = useRef<InterviewStep>("intro");
  const currentQuestionIndexRef = useRef(-1);
  const hasStartedRef = useRef(false);
  const questionsRef = useRef<Array<{ question: string; blueprint: string }>>(
    []
  );
  const completedRef = useRef(false);
  const processingAnswerRef = useRef(false);
  const lastProcessedMessageIndexRef = useRef(-1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingStartInProgressRef = useRef(false);
  const selectedMimeTypeRef = useRef<string | null>(null);
  const manualInputRef = useRef("");
  const handleUserResponseRef = useRef<(transcript: string) => void>(
    () => {}
  );
  const router = useRouter();

  // ══════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ══════════════════════════════════════════════════════════════

  const setStep = useCallback(
    (step: InterviewStep) => {
      interviewStepRef.current = step;
      setInterviewStep(step);
    },
    []
  );

  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      mediaStreamRef.current = stream;
    } catch (err) {
      console.error("Media access denied:", err);
    }
  }, []);

  const stopMedia = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((track) => track.stop());
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const sendAiMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "ai", content }]);
  }, []);

  const sendUserMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { role: "user", content }]);
  }, []);

  // ─── Helper: Get a valid microphone stream ──────────────────
  const getMicrophoneStream = useCallback(async (): Promise<MediaStream | null> => {
    try {
      console.log("[STT] Requesting microphone");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks.some((t) => t.readyState === "live")) {
        console.warn("[STT] No live audio tracks in stream");
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      console.log("[STT] Microphone stream acquired, tracks:", audioTracks.length);
      return stream;
    } catch (err) {
      console.error("[STT] getUserMedia failed:", err);
      return null;
    }
  }, []);

  // ─── Helper: Select best supported MIME type ─────────────────
  const selectMimeType = useCallback((): string | null => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];
    const supported: string[] = [];
    for (const mime of candidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        supported.push(mime);
      }
    }
    console.log("[STT] Supported MIME types:", supported.length > 0 ? supported.join(", ") : "none from list");
    if (supported.length > 0) {
      console.log("[STT] Selected MIME type:", supported[0]);
      return supported[0];
    }
    // Try browser default
    try {
      const testRecorder = new MediaRecorder(new MediaStream());
      const defaultType = testRecorder.mimeType;
      testRecorder.stream.getTracks().forEach((t) => t.stop());
      if (defaultType && MediaRecorder.isTypeSupported(defaultType)) {
        console.log("[STT] Using browser default MIME type:", defaultType);
        return defaultType;
      }
    } catch { /* noop */ }
    console.warn("[STT] No supported MIME type found");
    return null;
  }, []);

  // ─── Helper: Stop and cleanup a stream ───────────────────────
  const cleanupStream = useCallback((stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  // ─── MediaRecorder + Whisper STT ─────────────────────────────
  const startRecording = useCallback(async () => {
    // Prevent duplicate starts
    if (recordingStartInProgressRef.current) {
      console.warn("[STT] Start already in progress, skipping");
      return;
    }
    if (recordingState === "recording" || recordingState === "transcribing") {
      console.warn("[STT] Already recording or transcribing, skipping");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      console.warn("[STT] MediaRecorder not supported");
      setRecordingState("error");
      setErrorMessage("Voice recording is not supported in this browser. Please type your answer.");
      return;
    }
    recordingStartInProgressRef.current = true;

    try {
      // Step 1: Select MIME type
      const mimeType = selectMimeType();
      if (!mimeType) {
        setRecordingState("error");
        setErrorMessage("Voice recording is not supported in this browser. Please type your answer.");
        return;
      }
      selectedMimeTypeRef.current = mimeType;

      // Step 2: Get or validate microphone stream
      let stream = mediaStreamRef.current;
      if (stream) {
        const hasLiveAudio = stream.getAudioTracks().some((t) => t.readyState === "live");
        if (!hasLiveAudio || !stream.active) {
          console.log("[STT] Existing stream invalid, getting fresh stream");
          cleanupStream(stream);
          stream = null;
          mediaStreamRef.current = null;
        }
      }
      if (!stream) {
        stream = await getMicrophoneStream();
        if (!stream) {
          setRecordingState("error");
          setErrorMessage("Could not access microphone. Please allow microphone permission and try again, or type your response.");
          return;
        }
        mediaStreamRef.current = stream;
      }

      // Step 3: Stop existing recorder
      if (mediaRecorderRef.current) {
        try { if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop(); } catch { /* noop */ }
        mediaRecorderRef.current = null;
      }

      // Step 4: Create MediaRecorder with fallback
      let recorder: MediaRecorder;
      try {
        console.log("[STT] Creating MediaRecorder with MIME type:", mimeType);
        recorder = new MediaRecorder(stream, { mimeType });
      } catch (createErr) {
        console.warn("[STT] Failed with mimeType:", mimeType, createErr);
        try {
          console.log("[STT] Trying MediaRecorder without explicit MIME type");
          recorder = new MediaRecorder(stream);
          console.log("[STT] Recorder created with default type:", recorder.mimeType);
        } catch (fallbackErr) {
          console.error("[STT] MediaRecorder creation failed entirely:", fallbackErr);
          cleanupStream(stream);
          mediaStreamRef.current = null;
          setRecordingState("error");
          setErrorMessage("Voice recording is not supported in this browser. Please type your answer.");
          return;
        }
      }
      selectedMimeTypeRef.current = recorder.mimeType || mimeType;
      console.log("[STT] Actual recorder MIME type:", selectedMimeTypeRef.current);

      // Step 5: Clear chunks and wire handlers
      audioChunksRef.current = [];

      // Store handlers in refs so we can re-attach if needed
      const handleDataAvailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      const handleStop = async () => {
        console.log("[STT] Recorder stopped, chunks:", audioChunksRef.current.length);
        if (audioChunksRef.current.length === 0) { setRecordingState("idle"); return; }
        setRecordingState("transcribing");
        try {
          const actualType = selectedMimeTypeRef.current || "audio/webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: actualType });
          console.log(`[STT] Blob created: ${(audioBlob.size / 1024).toFixed(1)}KB, type: ${actualType}`);
          if (audioBlob.size < 1000) { console.log("[STT] Recording too short, discarding"); setRecordingState("idle"); return; }
          let ext = "webm";
          if (actualType.includes("mp4")) ext = "mp4";
          else if (actualType.includes("ogg")) ext = "ogg";
          else if (actualType.includes("wav")) ext = "wav";
          console.log("[STT] Sending audio to Whisper");
          const formData = new FormData();
          formData.append("audio", audioBlob, `recording-${Date.now()}.${ext}`);
          const response = await fetch("/api/interview/transcribe", { method: "POST", body: formData });
          const data = await response.json();
          console.log("[STT] Whisper response:", data.success ? "success" : "error", data.text || "");
          if (data.success && data.text) {
            manualInputRef.current = data.text;
            setRecordingState("idle");
            handleUserResponseRef.current(data.text);
          } else if (data.success && !data.text) {
            setRecordingState("idle");
            setErrorMessage("Your answer was not detected. Please try again or type your response.");
          } else {
            setRecordingState("error");
            setErrorMessage(data.error || "Failed to transcribe audio. Please try again.");
          }
        } catch (err) {
          console.error("[STT] Transcription error:", err);
          setRecordingState("error");
          setErrorMessage("Network error during transcription. Please try again or type your response.");
        }
      };
      const handleError = (event: Event) => {
        console.error("[STT] Recorder error:", event);
        cleanupStream(mediaStreamRef.current);
        mediaStreamRef.current = null;
        setRecordingState("error");
        setErrorMessage("Recording failed. Please try again or type your response.");
      };

      recorder.ondataavailable = handleDataAvailable;
      recorder.onstop = handleStop;
      recorder.onerror = handleError;

      // Step 6: Validate state and start
      console.log("[STT] Recorder state before start:", recorder.state);
      if (recorder.state !== "inactive") {
        setRecordingState("error");
        setErrorMessage("Recording system is in an unexpected state. Please try again.");
        return;
      }

      // Validate tracks are live
      const liveTracks = stream.getAudioTracks().filter((t) => t.readyState === "live");
      if (liveTracks.length === 0) {
        console.warn("[STT] No live audio tracks, getting fresh stream");
        cleanupStream(stream);
        const freshStream = await getMicrophoneStream();
        if (!freshStream) {
          setRecordingState("error");
          setErrorMessage("Microphone is unavailable. Please check your microphone and try again.");
          return;
        }
        mediaStreamRef.current = freshStream;
        try {
          recorder = new MediaRecorder(freshStream, { mimeType: selectedMimeTypeRef.current || undefined });
          selectedMimeTypeRef.current = recorder.mimeType || selectedMimeTypeRef.current;
        } catch {
          try { recorder = new MediaRecorder(freshStream); selectedMimeTypeRef.current = recorder.mimeType; } catch {
            cleanupStream(freshStream); mediaStreamRef.current = null;
            setRecordingState("error"); setErrorMessage("Could not start voice recording. Please type your answer."); return;
          }
        }
        audioChunksRef.current = [];
        recorder.ondataavailable = handleDataAvailable;
        recorder.onstop = handleStop;
        recorder.onerror = handleError;
        mediaRecorderRef.current = recorder;
      }

      // Step 7: Start
      try {
        recorder.start();
        console.log("[STT] Recorder started, state:", recorder.state);
        mediaRecorderRef.current = recorder;
        setRecordingState("recording");
        setErrorMessage(null);
      } catch (startErr) {
        console.error("[STT] recorder.start() failed:", startErr);
        try { recorder.stop(); } catch { /* noop */ }
        cleanupStream(mediaStreamRef.current);
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        setRecordingState("error");
        setErrorMessage("Could not start recording. Please try again or type your response.");
      }
    } catch (err) {
      console.error("[STT] Unexpected error:", err);
      cleanupStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setRecordingState("error");
      setErrorMessage("Could not access microphone. Please allow microphone permission and try again, or type your response.");
    } finally {
      recordingStartInProgressRef.current = false;
    }
  }, [recordingState, selectMimeType, getMicrophoneStream, cleanupStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === "recording" || mediaRecorderRef.current.state === "paused") {
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.warn("[STT] Error stopping recorder:", err);
      }
    }
  }, []);

  const retryRecording = useCallback(() => {
    // Clean up previous recorder completely
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch { /* noop */ }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      cleanupStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setErrorMessage(null);
    setRecordingState("idle");
    // Fresh start after cleanup
    setTimeout(() => startRecording(), 300);
  }, [startRecording, cleanupStream]);

  // handleUserResponse: use ref-based forwarding to break circular dep
  const handleUserResponseImpl = useCallback(
    (transcript: string) => {
      const currentStep = interviewStepRef.current;
      if (
        currentStep === "completed" ||
        currentStep === "completing" ||
        currentStep === "blocked"
      )
        return;
      stopRecording();
      sendUserMessage(transcript);
    },
    [stopRecording, sendUserMessage]
  );

  useEffect(() => {
    handleUserResponseRef.current = handleUserResponseImpl;
  }, [handleUserResponseImpl]);

  const playAiVoice = useCallback(
    async (text: string, onEnded?: () => void) => {
      setIsAiSpeaking(true);
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
        }

        const truncated =
          text.length > 1000 ? text.slice(0, 997) + "..." : text;
        const audioUrl = `/api/tts/stream?text=${encodeURIComponent(truncated)}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        let finished = false;
        const finishOnce = () => {
          if (finished) return;
          finished = true;
          setIsAiSpeaking(false);
          if (onEnded) {
            onEnded();
          }
        };

        audio.onplay = () => setIsAiSpeaking(true);
        audio.onended = finishOnce;
        audio.onerror = () => {
          console.error("TTS Audio Error");
          finishOnce();
        };

        await audio.play();
      } catch (err) {
        console.error("TTS Error:", err);
        setIsAiSpeaking(false);
        if (onEnded) onEnded();
      }
    },
    []
  );

  const askQuestion = useCallback(
    (
      index: number,
      questionsOverride?: Array<{ question: string; blueprint: string }>
    ) => {
      const qs = questionsOverride || questionsRef.current;
      if (index >= qs.length) {
        setStep("completing");
        return;
      }

      const questionItem = qs[index];
      const questionText =
        typeof questionItem === "string"
          ? questionItem
          : questionItem.question;
      const displayNum = index + 1;

      currentQuestionIndexRef.current = index;
      setQuestionNumber(displayNum);
      setStep("asking");

      sendAiMessage(
        `Question ${displayNum} of ${TOTAL_QUESTIONS}: ${questionText}`
      );

      setTimeout(() => {
        playAiVoice(questionText, () => {
          // After TTS finishes, start recording automatically
          startRecording();
        });
      }, 500);
    },
    [sendAiMessage, playAiVoice, startRecording, setStep]
  );

  const fetchAndAskQuestions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/interview/questions?candidateId=${interviewId}`
      );
      const data = await res.json();

      if (Array.isArray(data) && data.length >= 10) {
        questionsRef.current = data;
        askQuestion(0, data);
      } else {
        console.error("Invalid questions response:", data);
        sendAiMessage(
          "I'm having trouble generating questions right now. Let me try again..."
        );
        setTimeout(() => {
          setStep("waiting_permission");
        }, 3000);
      }
    } catch (err) {
      console.error("Failed to fetch questions:", err);
      sendAiMessage(
        "I'm having technical difficulties generating questions. Please try again later."
      );
      setStep("error");
    }
  }, [interviewId, askQuestion, sendAiMessage, setStep]);

  // ══════════════════════════════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════════════════════════════

  // EFFECT 1: Initialization — fetch candidate, greet, ask permission
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    fetch(`/api/candidate/${interviewId}`)
      .then((res) => res.json())
      .then(async (data) => {
        if (!data.candidate) return;

        if (data.candidate.status === "Completed") {
          setBlockedCandidateName(data.candidate.name || name);
          setIsAccessBlocked(true);
          setStep("blocked");
          return;
        }

        startMedia();

        let jobTitle = "this position";
        try {
          const candRes = await fetch(`/api/candidate/${interviewId}`);
          const candData = await candRes.json();
          if (candData.candidate) {
            jobTitle =
              candData.candidate.linkedJobTitle ||
              candData.candidate.jobTitle ||
              "this position";
          }
        } catch {
          /* use fallback */
        }

        const greeting = `Hi ${name || "there"}, welcome to your AI interview for the ${jobTitle} position. I'll ask you 10 questions about the role and your experience. Before we begin, are you ready to start?`;

        sendAiMessage(greeting);

        setTimeout(() => {
          playAiVoice(greeting, () => {
            setStep("waiting_permission");
          });
        }, GREETING_DELAY_MS);
      })
      .catch((err) => {
        console.error("Failed to fetch candidate:", err);
        setStep("error");
      });

    return () => {
      stopMedia();
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        } catch { /* noop */ }
        mediaRecorderRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // EFFECT 2: Handle user responses — SINGLE message handler
  useEffect(() => {
    if (messages.length === 0) return;

    const currentStep = interviewStepRef.current;

    if (
      currentStep === "completed" ||
      currentStep === "completing" ||
      currentStep === "blocked" ||
      currentStep === "error" ||
      currentStep === "generating"
    )
      return;

    // Find the last user message that hasn't been processed yet
    for (let i = messages.length - 1; i >= 0; i--) {
      if (
        messages[i].role === "user" &&
        i > lastProcessedMessageIndexRef.current
      ) {
        const response = messages[i].content.toLowerCase().trim();

        if (currentStep === "waiting_permission") {
          lastProcessedMessageIndexRef.current = i;

          // Normalize: trim, lowercase, remove punctuation
          const normalized = response
            .replace(/[.,!?;:'"]/g, "")
            .trim();

          const yesPatterns =
            /^(yes|yeah|yep|sure|okay|ok|ready|i'?m ready|i am ready|let'?s start|lets start|absolutely|go ahead|let'?s do this|let's go|sounds good)\b/i;
          const noPatterns =
            /^(no|not now|later|i'?m not ready|i am not ready|not ready|maybe|nah|nope)\b/i;

          if (yesPatterns.test(normalized)) {
            const confirmMsg =
              "Great! Let me generate your personalized interview questions. This will just take a moment...";
            setTimeout(() => {
              sendAiMessage(confirmMsg);
              setTimeout(() => {
                playAiVoice(confirmMsg, () => {
                  setStep("generating");
                  fetchAndAskQuestions();
                });
              }, 300);
            }, 100);
          } else if (noPatterns.test(normalized)) {
            const waitMsg =
              "No problem. Take your time. Let me know when you're ready to begin.";
            setTimeout(() => {
              sendAiMessage(waitMsg);
              setTimeout(() => {
                playAiVoice(waitMsg, () => {
                  // Ready for next confirmation attempt
                });
              }, 300);
            }, 100);
          } else {
            // Ambiguous — ask again
            const clarifyMsg =
              "I didn't quite catch that. Are you ready to begin?";
            setTimeout(() => {
              sendAiMessage(clarifyMsg);
              setTimeout(() => {
                playAiVoice(clarifyMsg, () => {
                  // Ready for next confirmation attempt
                });
              }, 300);
            }, 100);
          }
          return;
        }

        if (currentStep === "asking") {
          // Guard: prevent duplicate processing
          if (processingAnswerRef.current) return;
          processingAnswerRef.current = true;
          lastProcessedMessageIndexRef.current = i;

          // Step 1: Move to processing state
          setStep("processing_answer");

          // Step 2: Advance to next question after brief delay
          const nextIndex = currentQuestionIndexRef.current + 1;
          if (nextIndex >= TOTAL_QUESTIONS) {
            // All questions answered — begin completion
            setTimeout(() => {
              setStep("completing");
              processingAnswerRef.current = false;
            }, QUESTION_DELAY_MS);
          } else {
            setTimeout(() => {
              askQuestion(nextIndex);
              processingAnswerRef.current = false;
            }, QUESTION_DELAY_MS);
          }
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // EFFECT 3: Completion — API call FIRST, then final message
  useEffect(() => {
    if (interviewStep !== "completing" || completedRef.current) return;
    completedRef.current = true;

    // Show evaluating state immediately
    sendAiMessage("Evaluating your responses...");

    const finalMsg =
      "Thank you so much for your time today, " +
      (name || "candidate") +
      ". Your responses have been recorded and will be reviewed. Have a wonderful day!";

    fetch("/api/interview/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: interviewId,
        candidateName: name,
        transcript: messages,
        questions: questionsRef.current,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAnalysis(data.evaluation);
        } else if (data.error === "Interview already completed") {
          setAnalysis(data.evaluation ?? null);
        }

        // After API completes, play final message then mark completed
        playAiVoice(finalMsg, () => {
          setTimeout(() => {
            setStep("completed");
            setIsFinished(true);
            stopMedia();
          }, 1000);
        });
      })
      .catch((err) => {
        console.error("Failed to save interview:", err);
        // Still play final message on network failure
        playAiVoice(finalMsg, () => {
          setTimeout(() => {
            setStep("completed");
            setIsFinished(true);
            stopMedia();
          }, 1000);
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewStep]);

  // EFFECT 4: Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ══════════════════════════════════════════════════════════════
  // EARLY RETURNS
  // ══════════════════════════════════════════════════════════════

  if (isFinished) {
    return <InterviewSummaryViewer analysis={analysis} name={name} />;
  }

  if (isAccessBlocked) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
          <ShieldAlert className="w-10 h-10 text-rose-500" />
        </div>
        <h2 className="text-3xl font-black text-white">
          Interview Already Completed
        </h2>
        <p className="text-slate-400 max-w-md">
          This interview for {blockedCandidateName || "the candidate"} was
          already completed. It cannot be started again.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button
            onClick={() =>
              router.push(`/interview/${interviewId}?view=summary`)
            }
            className="bg-emerald-600 hover:bg-emerald-500 rounded-2xl h-12 px-8 font-bold"
          >
            View Summary
          </Button>
          <Button
            onClick={() => router.push("/dashboard")}
            className="bg-indigo-600 hover:bg-indigo-500 rounded-2xl h-12 px-8 font-bold"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // UI: Header status text
  // ══════════════════════════════════════════════════════════════

  const getHeaderStatus = (): { text: string; color: string } => {
    switch (interviewStep) {
      case "intro":
        return { text: "Initializing...", color: "text-slate-400" };
      case "waiting_permission":
        return {
          text: "Waiting for confirmation...",
          color: "text-amber-400",
        };
      case "generating":
        return {
          text: "Generating questions...",
          color: "text-indigo-400",
        };
      case "asking":
        return {
          text: isAiSpeaking
            ? "Sarah is speaking..."
            : recordingState === "recording"
            ? "Recording..."
            : recordingState === "transcribing"
            ? "Transcribing..."
            : "Your turn to answer",
          color: isAiSpeaking
            ? "text-indigo-400"
            : recordingState === "recording"
            ? "text-red-400"
            : "text-emerald-400",
        };
      case "processing_answer":
        return {
          text: "Processing your answer...",
          color: "text-amber-400",
        };
      case "completing":
        return {
          text: "Evaluating your responses...",
          color: "text-amber-400",
        };
      case "completed":
        return { text: "Interview completed", color: "text-emerald-400" };
      case "error":
        return { text: "Something went wrong", color: "text-rose-400" };
      default:
        return { text: "Live Screening", color: "text-emerald-500" };
    }
  };

  const headerStatus = getHeaderStatus();

  // Determine if we should show the recording controls
  const showRecordingControls =
    interviewStep === "waiting_permission" || interviewStep === "asking";
  const isWaitingOrAsking =
    interviewStep === "waiting_permission" || interviewStep === "asking";

  // ══════════════════════════════════════════════════════════════
  // RENDER: Main Interview Room
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="h-screen bg-[#050505] text-slate-50 flex flex-col overflow-hidden font-sans">
      {/* ── Header ── */}
      <header className="h-16 border-b border-white/5 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/20">
            <Bot className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight">
              Interview Room
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${headerStatus.color}`}
            >
              {headerStatus.text}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {questionNumber > 0 &&
            interviewStep !== "completed" &&
            interviewStep !== "completing" && (
              <Badge
                variant="outline"
                className="bg-indigo-500/10 border-indigo-500/20 text-indigo-300 px-3 py-1 text-[11px] font-bold"
              >
                Question {questionNumber} of {TOTAL_QUESTIONS}
              </Badge>
            )}
          {interviewStep === "completing" && (
            <Badge
              variant="outline"
              className="bg-amber-500/10 border-amber-500/20 text-amber-300 px-3 py-1 text-[11px] font-bold"
            >
              Evaluating...
            </Badge>
          )}
          <Badge
            variant="outline"
            className="bg-white/5 border-white/10 text-slate-400 px-3 py-1"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
            Session ID: {interviewId.slice(0, 8)}
          </Badge>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* ── Left: Video Area ── */}
        <div className="flex-1 relative bg-slate-950 flex flex-col items-center justify-center p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl aspect-video">
            {/* AI Agent View */}
            <Card className="relative bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/5 flex flex-col items-center justify-center">
              <div className="absolute top-4 left-4 z-10">
                <Badge className="bg-indigo-500/20 text-indigo-300 border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                  Sarah AI
                </Badge>
              </div>
              <div className="relative">
                <AnimatePresence>
                  {isAiSpeaking && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{ scale: 2, opacity: 0 }}
                          transition={{
                            repeat: Infinity,
                            duration: 2,
                            delay: i * 0.6,
                          }}
                          className="absolute w-32 h-32 rounded-full border border-indigo-500/30"
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div
                  className={`w-32 h-32 rounded-full bg-indigo-500/10 border-2 transition-all duration-500 flex items-center justify-center ${
                    isAiSpeaking
                      ? "border-indigo-500 scale-110 shadow-[0_0_40px_rgba(99,102,241,0.4)]"
                      : "border-slate-800"
                  }`}
                >
                  <Bot
                    className={`w-12 h-12 transition-colors ${
                      isAiSpeaking ? "text-indigo-400" : "text-slate-600"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-8 text-center">
                <p
                  className={`text-sm font-bold uppercase tracking-[0.2em] transition-colors ${
                    isAiSpeaking ? "text-indigo-400" : "text-slate-600"
                  }`}
                >
                  {isAiSpeaking
                    ? "Speaking..."
                    : interviewStep === "completing"
                    ? "Evaluating..."
                    : recordingState === "recording"
                    ? "Recording..."
                    : recordingState === "transcribing"
                    ? "Processing..."
                    : "Listening..."}
                </p>
              </div>
            </Card>

            {/* Candidate Webcam */}
            <Card className="relative bg-black border-slate-800/60 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/5">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute top-4 left-4 z-10">
                <Badge className="bg-black/40 backdrop-blur-md text-white border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                  {name}
                </Badge>
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    recordingState === "recording"
                      ? "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                      : recordingState === "transcribing"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-slate-600"
                  }`}
                />
              </div>
            </Card>
          </div>

          {/* Floating Controls */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/40 backdrop-blur-2xl border border-white/5 rounded-3xl p-3 shadow-2xl px-6">
            {/* Record / Stop button */}
            {showRecordingControls && !isAiSpeaking && (
              <>
                {recordingState === "idle" || recordingState === "error" ? (
                  <Button
                    size="icon"
                    onClick={startRecording}
                    className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/30"
                    title="Start recording"
                  >
                    <Mic className="w-7 h-7" />
                  </Button>
                ) : recordingState === "recording" ? (
                  <Button
                    size="icon"
                    onClick={stopRecording}
                    className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/30 animate-pulse"
                    title="Stop recording"
                  >
                    <Square className="w-6 h-6" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    disabled
                    className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  >
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </Button>
                )}
              </>
            )}

            {/* Mute button (always visible) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (recordingState === "recording") {
                  stopRecording();
                }
              }}
              className="w-12 h-12 rounded-2xl hover:bg-white/5 text-slate-400"
            >
              <MicOff className="w-6 h-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-2xl hover:bg-white/5 text-slate-400"
            >
              <Video className="w-6 h-6" />
            </Button>

            <div className="w-px h-8 bg-white/10 mx-2" />

            <Button
              variant="destructive"
              className="h-12 px-6 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-500/20"
              onClick={() => (window.location.href = "/dashboard")}
            >
              <PhoneOff className="w-5 h-5" /> End Call
            </Button>
          </div>
        </div>

        {/* ── Right: Chat Sidebar ── */}
        <aside className="w-96 border-l border-white/5 bg-[#0a0a0f] flex flex-col z-10">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">
              Live Transcript
            </h3>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  recordingState === "recording"
                    ? "bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    : recordingState === "transcribing"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-slate-500"
                }`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  recordingState === "recording"
                    ? "text-red-400"
                    : recordingState === "transcribing"
                    ? "text-amber-400"
                    : "text-slate-500"
                }`}
              >
                {recordingState === "recording"
                  ? "Recording..."
                  : recordingState === "transcribing"
                  ? "Transcribing..."
                  : "Ready"}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${
                  msg.role === "ai" ? "items-start" : "items-end"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                    msg.role === "ai"
                      ? "bg-indigo-600/10 text-indigo-200 border border-indigo-500/20 rounded-tl-none"
                      : "bg-white/5 text-slate-200 border border-white/5 rounded-tr-none"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-2 px-1">
                  {msg.role === "ai" ? "Sarah AI" : "You"} &bull;{" "}
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </motion.div>
            ))}

            {interviewStep === "generating" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-indigo-400 text-sm"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating your interview questions...</span>
              </motion.div>
            )}
            {interviewStep === "completing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-amber-400 text-sm"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating your responses...</span>
              </motion.div>
            )}
            {interviewStep === "error" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-rose-400 text-sm"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>
                  Something went wrong. Please refresh the page to try again.
                </span>
              </motion.div>
            )}

            {/* Recording status indicator */}
            {recordingState === "recording" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-red-400 text-xs"
              >
                <div className="flex gap-0.5">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      delay: 0,
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-red-400"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      delay: 0.2,
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-red-400"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.8,
                      delay: 0.4,
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-red-400"
                  />
                </div>
                <span>Recording — speak now, then press Done</span>
              </motion.div>
            )}

            {recordingState === "transcribing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-amber-400 text-xs"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Processing your response...</span>
              </motion.div>
            )}

            {/* Error banner with retry */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <MicOff className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm text-amber-200">{errorMessage}</p>
                    <p className="text-xs text-amber-400/60">
                      You can always type your answer below.
                    </p>
                  </div>
                </div>
                {isWaitingOrAsking && !isAiSpeaking && (
                  <Button
                    size="sm"
                    onClick={retryRecording}
                    className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold h-8 px-4"
                  >
                    <Mic className="w-3 h-3 mr-1.5" /> Try Voice Again
                  </Button>
                )}
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20">
            <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl p-3 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
              <Input
                placeholder={
                  interviewStep === "waiting_permission"
                    ? "Type yes or no..."
                    : interviewStep === "asking"
                    ? "Type your response..."
                    : "Chat..."
                }
                value={manualInput}
                onChange={(e) => {
                  setManualInput(e.target.value);
                  manualInputRef.current = e.target.value;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualInput.trim()) {
                    const typedText = manualInput.trim();
                    setManualInput("");
                    manualInputRef.current = "";
                    handleUserResponseRef.current(typedText);
                  }
                }}
                className="bg-transparent border-none focus-visible:ring-0 text-sm h-auto p-0 text-white"
              />
              <Button
                size="icon"
                onClick={() => {
                  if (manualInput.trim()) {
                    const typedText = manualInput.trim();
                    setManualInput("");
                    manualInputRef.current = "";
                    handleUserResponseRef.current(typedText);
                  }
                }}
                className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-500 text-center mt-4 uppercase tracking-widest font-bold">
              {interviewStep === "waiting_permission"
                ? "Record or type to confirm"
                : interviewStep === "asking"
                ? "Record your answer or type below"
                : "Speak or type to interact"}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

// ─── Info Item (Join Page) ────────────────────────────────────────
function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-slate-800/40 rounded-2xl p-4 ring-1 ring-white/5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

// ─── Interview Summary Viewer ─────────────────────────────────────
function InterviewSummaryViewer({
  analysis,
  name,
}: {
  analysis: Record<string, unknown> | null;
  name: string;
}) {
  const totalScore = (analysis?.totalScore as number) ?? null;
  const breakdown =
    (analysis?.breakdown as Array<Record<string, unknown>>) ?? [];
  const summary =
    (analysis?.executiveSummary as string) ??
    (analysis?.summary as string) ??
    null;

  const scoreColor =
    totalScore === null
      ? "text-slate-400"
      : totalScore >= 75
      ? "text-emerald-400"
      : totalScore >= 50
      ? "text-amber-400"
      : "text-red-400";

  const scoreBarColor =
    totalScore === null
      ? "bg-slate-600"
      : totalScore >= 75
      ? "bg-emerald-500"
      : totalScore >= 50
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center px-6 py-16 relative overflow-y-auto font-sans">
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] opacity-10 pointer-events-none blur-[140px] bg-emerald-500 rounded-full" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] opacity-10 pointer-events-none blur-[140px] bg-indigo-500 rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl w-full space-y-8 relative z-10"
      >
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Interview Complete
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-2">
            Your Results, {name}
          </h1>
          <p className="text-slate-400">
            Here is your full AI-generated performance breakdown.
          </p>
        </div>

        {/* Score Card */}
        <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-8">
          <div className="text-center md:text-left shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Final Score
            </p>
            {totalScore !== null ? (
              <div
                className={`text-8xl font-black tabular-nums leading-none ${scoreColor}`}
              >
                {totalScore}
                <span className="text-3xl text-slate-600 font-bold">/100</span>
              </div>
            ) : (
              <div className="text-4xl font-black text-slate-500">
                Pending Analysis
              </div>
            )}
          </div>
          <div className="flex-1 w-full space-y-4">
            {totalScore !== null && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 font-bold mb-2 uppercase tracking-widest">
                  <span>Score</span>
                  <span>{totalScore}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${totalScore}%` }}
                    transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                    className={`h-full rounded-full ${scoreBarColor}`}
                  />
                </div>
              </div>
            )}
            {summary && (
              <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/40 pl-4">
                &ldquo;{summary}&rdquo;
              </p>
            )}
            {!analysis && (
              <p className="text-sm text-slate-400">
                This interview was completed before detailed analysis was
                enabled.
              </p>
            )}
          </div>
        </Card>

        {/* Per-Question Breakdown */}
        {breakdown.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
              Question-by-Question Breakdown
            </h2>
            {breakdown.map((item, i) => {
              const marks = (item.marks as number) ?? 0;
              const markColor =
                marks >= 7
                  ? "text-emerald-400"
                  : marks >= 4
                  ? "text-amber-400"
                  : "text-red-400";
              const markBarColor =
                marks >= 7
                  ? "bg-emerald-500"
                  : marks >= 4
                  ? "bg-amber-500"
                  : "bg-red-500";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                >
                  <Card className="bg-[#0c0c14] border-slate-800/50 rounded-[2rem] overflow-hidden">
                    <div className="flex items-start justify-between gap-4 p-6 pb-4">
                      <div className="space-y-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                          Question {i + 1}
                        </span>
                        <p className="text-sm font-semibold text-white leading-snug">
                          {item.question as string}
                        </p>
                      </div>
                      <div className="shrink-0 text-center min-w-[60px]">
                        <div
                          className={`text-2xl font-black tabular-nums leading-none ${markColor}`}
                        >
                          {marks}
                          <span className="text-slate-600 text-sm font-bold">
                            /10
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${markBarColor}`}
                            style={{ width: `${marks * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6 space-y-3">
                      <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Bot className="w-3 h-3" /> Expected Answer
                        </span>
                        <p className="text-sm text-indigo-100/80 leading-relaxed">
                          {item.expectedAnswer as string}
                        </p>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <User className="w-3 h-3" /> Your Answer
                        </span>
                        <p className="text-sm text-slate-300 italic leading-relaxed">
                          &ldquo;
                          {(item.userAnswer as string) || "[No answer recorded]"}
                          &rdquo;
                        </p>
                      </div>

                      <div
                        className={`rounded-2xl p-4 space-y-1.5 border ${
                          marks >= 7
                            ? "bg-emerald-500/5 border-emerald-500/15"
                            : marks >= 4
                            ? "bg-amber-500/5 border-amber-500/15"
                            : "bg-red-500/5 border-red-500/15"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${markColor}`}
                        >
                          <Sparkles className="w-3 h-3" /> Marks Awarded:{" "}
                          {marks} / 10
                        </span>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {item.feedback as string}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Final Score Summary Banner */}
        {totalScore !== null && (
          <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] ring-1 ring-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                Overall Performance
              </p>
              <p className={`text-2xl font-extrabold ${scoreColor}`}>
                {totalScore >= 75
                  ? "🌟 Excellent"
                  : totalScore >= 50
                  ? "👍 Good"
                  : "📚 Needs Improvement"}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {totalScore >= 75
                  ? "Outstanding performance — highly recommended!"
                  : totalScore >= 50
                  ? "Solid candidate with room to grow."
                  : "Candidate may need more preparation."}
              </p>
            </div>
            <div className={`text-5xl font-black tabular-nums ${scoreColor}`}>
              {totalScore}
              <span className="text-slate-600 text-2xl font-bold">/100</span>
            </div>
          </Card>
        )}

        {/* Return to Dashboard */}
        <div className="pb-12">
          <Button
            onClick={() => (window.location.href = "/dashboard")}
            className="w-full h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all"
          >
            Return to Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
