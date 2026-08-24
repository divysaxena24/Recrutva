"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  Circle,
  Minus,
  Loader2,
  ArrowRight,
  ChevronDown,
  Trophy,
  AlertCircle,
  FileText,
  Bot,
  MessageSquare,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  getCandidatePipeline,
  completeCandidateRound,
  moveCandidateToRound,
} from "@/app/actions/candidate-pipeline";

// ─── Types ────────────────────────────────────────────────────────
type RoundData = {
  roundId: number;
  candidateRoundId: number | null;
  name: string;
  type: string;
  order: number;
  status: string;
  score: number | null;
  feedback: string | null;
  evaluation: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
};

type PipelineData = {
  candidate: { id: number; name: string; email: string; targetJobId: number | null };
  rounds: RoundData[];
};

interface CandidatePipelineCardProps {
  candidateId: number;
  onPipelineChange?: () => void;
}

// ─── Round type icon mapping ──────────────────────────────────────
const ROUND_ICONS: Record<string, React.ElementType> = {
  RESUME_SCREENING: FileText,
  ASSESSMENT: ClipboardCheck,
  AI_INTERVIEW: MessageSquare,
  MANUAL_REVIEW: Bot,
};

// ─── Status icon & color helpers ──────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  const size = "w-5 h-5 shrink-0";
  switch (status) {
    case "PASSED":
      return <CheckCircle2 className={`${size} text-emerald-400`} />;
    case "ACTIVE":
      return (
        <div className={`${size} relative flex items-center justify-center`}>
          <Circle className={`${size} text-indigo-400 fill-indigo-400/20`} />
          <div className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping" />
        </div>
      );
    case "FAILED":
      return <XCircle className={`${size} text-rose-400`} />;
    case "SKIPPED":
      return <Minus className={`${size} text-slate-500`} />;
    default:
      return <Circle className={`${size} text-slate-600`} />;
  }
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PASSED: {
    label: "Passed",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  FAILED: {
    label: "Failed",
    className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  SKIPPED: {
    label: "Skipped",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
  NOT_STARTED: {
    label: "Not Started",
    className: "bg-slate-500/5 text-slate-600 border-slate-500/10",
  },
  PENDING: {
    label: "Pending",
    className: "bg-slate-500/5 text-slate-600 border-slate-500/10",
  },
};

// ─── Main Component ───────────────────────────────────────────────
export default function CandidatePipelineCard({
  candidateId,
  onPipelineChange,
}: CandidatePipelineCardProps) {
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Complete round state
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [activeRoundIndex, setActiveRoundIndex] = useState<number | null>(null);
  const [completeStatus, setCompleteStatus] = useState<"PASSED" | "FAILED">("PASSED");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Move round state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetRoundIndex, setMoveTargetRoundIndex] = useState<number | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPipeline = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getCandidatePipeline(candidateId);
      if (!mountedRef.current) return;
      if (!data) {
        setError("Pipeline not found or you don't have access.");
      } else {
        setPipeline(data);
      }
    } catch {
      if (!mountedRef.current) return;
      setError("Failed to load pipeline.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline(); // eslint-disable-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  // ─── Complete round handler ──────────────────────────────────
  const openCompleteDialog = (roundIndex: number, status: "PASSED" | "FAILED") => {
    setActiveRoundIndex(roundIndex);
    setCompleteStatus(status);
    setScore("");
    setFeedback("");
    setCompleteDialogOpen(true);
  };

  const handleCompleteRound = async () => {
    if (activeRoundIndex === null || !pipeline) return;

    const round = pipeline.rounds[activeRoundIndex];
    if (!round.candidateRoundId) {
      setError("Cannot complete this round: no candidate round record found.");
      setCompleteDialogOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const result = await completeCandidateRound({
        candidateRoundId: round.candidateRoundId,
        status: completeStatus,
        score: score ? parseInt(score) : undefined,
        feedback: feedback || undefined,
      });

      if (result.success) {
        setCompleteDialogOpen(false);
        await fetchPipeline();
        onPipelineChange?.();
      } else {
        setError(result.error || "Failed to complete round.");
        setCompleteDialogOpen(false);
      }
    } catch {
      setError("An unexpected error occurred.");
      setCompleteDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Move round handler ─────────────────────────────────────
  const handleMoveToRound = async () => {
    if (moveTargetRoundIndex === null || !pipeline) return;

    const targetRound = pipeline.rounds[moveTargetRoundIndex];

    setSubmitting(true);
    try {
      const result = await moveCandidateToRound({
        candidateId,
        roundId: targetRound.roundId,
      });

      if (result.success) {
        setMoveDialogOpen(false);
        setMoveTargetRoundIndex(null);
        await fetchPipeline();
        onPipelineChange?.();
      } else {
        setError(result.error || "Failed to move candidate.");
        setMoveDialogOpen(false);
      }
    } catch {
      setError("An unexpected error occurred.");
      setMoveDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-2xl">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          <span className="text-sm text-slate-400">Loading pipeline...</span>
        </div>
      </Card>
    );
  }

  // ─── Error state ──────────────────────────────────────────────
  if (error && !pipeline) {
    return (
      <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-2xl">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="text-sm text-rose-400">{error}</span>
        </div>
      </Card>
    );
  }

  // ─── No pipeline state ──────────────────────────────────────
  if (!pipeline || pipeline.rounds.length === 0) {
    return (
      <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-2xl">
        <div className="flex items-center gap-3">
          <Circle className="w-5 h-5 text-slate-600" />
          <span className="text-sm text-slate-500">
            No pipeline configured for this candidate&apos;s job.
          </span>
        </div>
      </Card>
    );
  }

  const activeRound = pipeline.rounds.find((r) => r.status === "ACTIVE");
  const allPassed = pipeline.rounds.every((r) => r.status === "PASSED");
  const hasFailed = pipeline.rounds.some((r) => r.status === "FAILED");

  return (
    <Card className="bg-[#0a0a0f] border-slate-800/60 rounded-2xl overflow-hidden">
      {/* Error toast */}
      {error && (
        <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-xs text-rose-400">{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto text-rose-400 hover:text-rose-300 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/20">
            <ArrowRight className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Pipeline</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {pipeline.rounds.length} rounds
            </p>
          </div>
        </div>

        {activeRound && (
          <Badge
            variant="outline"
            className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-bold"
          >
            Current: {activeRound.name}
          </Badge>
        )}

        {allPassed && (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold"
          >
            <Trophy className="w-3 h-3 mr-1" /> Pipeline Completed
          </Badge>
        )}

        {!activeRound && !allPassed && hasFailed && (
          <Badge
            variant="outline"
            className="bg-rose-500/10 text-rose-400 border-rose-500/20 px-3 py-1 rounded-full text-[10px] font-bold"
          >
            Round Failed
          </Badge>
        )}
      </div>

      {/* Rounds */}
      <div className="p-6">
        <div className="space-y-1">
          {pipeline.rounds.map((round, index) => {
            const config = STATUS_CONFIG[round.status] || STATUS_CONFIG.NOT_STARTED;
            const isActive = round.status === "ACTIVE";
            const isLast = index === pipeline.rounds.length - 1;
            const RoundIcon = ROUND_ICONS[round.type] || FileText;

            return (
              <div key={index}>
                <div
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                    isActive
                      ? "bg-indigo-500/5 ring-1 ring-indigo-500/10"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Status Icon */}
                  <StatusIcon status={round.status} />

                  {/* Round Type Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-indigo-500/10 ring-1 ring-indigo-500/20"
                        : "bg-slate-800/50"
                    }`}
                  >
                    <RoundIcon
                      className={`w-4 h-4 ${
                        isActive ? "text-indigo-400" : "text-slate-500"
                      }`}
                    />
                  </div>

                  {/* Round Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          isActive ? "text-white" : "text-slate-300"
                        }`}
                      >
                        {round.name}
                      </span>
                      <span className="text-[10px] text-slate-600 font-bold uppercase">
                        {round.type}
                      </span>
                    </div>

                    {/* Score & Feedback */}
                    {(round.score !== null || round.feedback) && (
                      <div className="flex items-center gap-3 mt-1">
                        {round.score !== null && (
                          <span className="text-[11px] text-slate-400">
                            Score:{" "}
                            <span className="font-bold text-white">{round.score}</span>
                          </span>
                        )}
                        {round.feedback && (
                          <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                            &quot;{round.feedback}&quot;
                          </span>
                        )}
                      </div>
                    )}

                    {/* Completed date */}
                    {round.completedAt && (
                      <span className="text-[10px] text-slate-600 mt-0.5 block">
                        Completed{" "}
                        {new Date(round.completedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <Badge
                    variant="outline"
                    className={`${config.className} px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider shrink-0`}
                  >
                    {config.label}
                  </Badge>

                  {/* Active Round Actions */}
                  {isActive && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCompleteDialog(index, "PASSED")}
                        className="h-8 px-3 rounded-lg text-[11px] font-bold border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pass
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCompleteDialog(index, "FAILED")}
                        className="h-8 px-3 rounded-lg text-[11px] font-bold border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Fail
                      </Button>
                    </div>
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div className="flex items-center ml-[10px] py-0">
                    <div
                      className={`w-px h-4 ${
                        round.status === "PASSED" ? "bg-emerald-500/30" : "bg-slate-800"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Manual Move Button */}
        {activeRound && (
          <div className="mt-4 pt-4 border-t border-slate-800/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMoveTargetRoundIndex(null);
                setMoveDialogOpen(true);
              }}
              className="h-8 px-3 rounded-lg text-[11px] font-bold border-slate-700 text-slate-400 hover:bg-white/5"
            >
              <ChevronDown className="w-3.5 h-3.5 mr-1" /> Move to Round
            </Button>
          </div>
        )}
      </div>

      {/* Complete Round Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden ring-1 ring-white/5">
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {completeStatus === "PASSED" ? "Mark as Passed" : "Mark as Failed"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {activeRoundIndex !== null && pipeline && (
                  <>
                    Round: <span className="font-bold text-white">{pipeline.rounds[activeRoundIndex].name}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-6">
              {/* Score */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Score (optional)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val)) {
                      setScore("");
                    } else if (val < 0) {
                      setScore("0");
                    } else if (val > 100) {
                      setScore("100");
                    } else {
                      setScore(e.target.value);
                    }
                  }}
                  placeholder="0-100"
                  className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30"
                />
              </div>

              {/* Feedback */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Feedback (optional)
                </Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add feedback for this round..."
                  className="bg-slate-950 border-slate-800 rounded-xl focus:ring-indigo-500/30 min-h-[80px]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCompleteDialogOpen(false)}
                className="flex-1 h-12 rounded-xl text-slate-400 hover:bg-white/5 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleCompleteRound}
                className={`flex-1 h-12 rounded-xl font-bold shadow-xl ${
                  completeStatus === "PASSED"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
                    : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20"
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : completeStatus === "PASSED" ? (
                  "Mark Passed"
                ) : (
                  "Mark Failed"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Move to Round Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden ring-1 ring-white/5">
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Move to Round
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Select the destination round for this candidate.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 mt-6">
              {pipeline?.rounds.map((round, index) => {
                const isCurrentActive = round.status === "ACTIVE";
                const config = STATUS_CONFIG[round.status] || STATUS_CONFIG.NOT_STARTED;
                const RoundIcon = ROUND_ICONS[round.type] || FileText;

                return (
                  <button
                    key={index}
                    onClick={() => setMoveTargetRoundIndex(index)}
                    disabled={isCurrentActive}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      moveTargetRoundIndex === index
                        ? "bg-indigo-500/10 ring-1 ring-indigo-500/30"
                        : isCurrentActive
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-white/[0.03] ring-1 ring-transparent"
                    }`}
                  >
                    <StatusIcon status={round.status} />
                    <div className="w-7 h-7 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0">
                      <RoundIcon className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-white">{round.name}</span>
                      <span className="text-[10px] text-slate-600 ml-2 uppercase">
                        {round.type}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${config.className} px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider`}
                    >
                      {config.label}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-8">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMoveDialogOpen(false)}
                className="flex-1 h-12 rounded-xl text-slate-400 hover:bg-white/5 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting || moveTargetRoundIndex === null}
                onClick={handleMoveToRound}
                className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Move Candidate"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
