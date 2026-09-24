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
  ExternalLink,
  Eye,
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
import { getValidResumeUrl } from "@/lib/utils";

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
  candidate: {
    id: number;
    name: string;
    email: string;
    targetJobId: number | null;
    resumeUrl: string | null;
  };
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
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Move round state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveTargetRoundIndex, setMoveTargetRoundIndex] = useState<number | null>(null);

  // Review mode: force-expands evaluation details (used for manual review).
  const [reviewMode, setReviewMode] = useState(false);

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
    setScoreError(null);
    setDialogError(null);
    setCompleteDialogOpen(true);
  };

  const handleCompleteRound = async () => {
    if (activeRoundIndex === null || !pipeline) return;

    setScoreError(null);
    setDialogError(null);

    let parsedScore: number | undefined = undefined;
    if (score !== "") {
      const val = parseInt(score, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        setScoreError("Score must be a number between 0 and 100");
        return;
      }
      parsedScore = val;
    }

    if (feedback.length > 2000) {
      setDialogError("Feedback cannot exceed 2000 characters");
      return;
    }

    const round = pipeline.rounds[activeRoundIndex];
    if (!round.candidateRoundId) {
      setDialogError("Cannot complete this round: no candidate round record found.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await completeCandidateRound({
        candidateRoundId: round.candidateRoundId,
        status: completeStatus,
        score: parsedScore,
        feedback: feedback || undefined,
      });

      if (result.success) {
        setCompleteDialogOpen(false);
        await fetchPipeline();
        onPipelineChange?.();
      } else {
        setDialogError(result.error || "Failed to complete round.");
      }
    } catch {
      setDialogError("An unexpected error occurred.");
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
      <Card className="p-8 bg-white border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
          <span className="text-sm font-medium text-slate-500">Loading pipeline...</span>
        </div>
      </Card>
    );
  }

  // ─── Error state ──────────────────────────────────────────────
  if (error && !pipeline) {
    return (
      <Card className="p-6 bg-white border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-sm text-rose-600 font-medium">{error}</span>
        </div>
      </Card>
    );
  }

  // ─── No pipeline state ──────────────────────────────────────
  if (!pipeline || pipeline.rounds.length === 0) {
    return (
      <Card className="p-6 bg-white border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <Circle className="w-5 h-5 text-slate-400" />
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
  const needsReview = activeRound?.type === "MANUAL_REVIEW";

  return (
    <Card className="bg-white border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
      {/* Error toast */}
      {error && (
        <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="text-xs text-rose-700 font-medium">{error}</span>
          <button
            onClick={() => setError("")}
            className="ml-auto text-rose-700 hover:text-rose-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 border border-indigo-200 p-2 rounded-xl">
            <ArrowRight className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Pipeline</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {pipeline.rounds.length} rounds
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {needsReview && (
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200 px-3 py-1 rounded-full text-[10px] font-bold animate-pulse"
            >
              Needs Review
            </Badge>
          )}

          {activeRound && !needsReview && (
            <Badge
              variant="outline"
              className="bg-indigo-50 text-indigo-700 border-indigo-200 px-3 py-1 rounded-full text-[10px] font-bold"
            >
              Current: {activeRound.name}
            </Badge>
          )}

          {allPassed && (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold"
            >
              <Trophy className="w-3 h-3 mr-1 text-emerald-600" /> Pipeline Completed
            </Badge>
          )}

          {!activeRound && !allPassed && hasFailed && (
            <Badge
              variant="outline"
              className="bg-rose-50 text-rose-700 border-rose-200 px-3 py-1 rounded-full text-[10px] font-bold"
            >
              Round Failed
            </Badge>
          )}

          {needsReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewMode((v) => !v)}
              className="h-8 px-3 rounded-lg text-[11px] font-bold border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100"
            >
              <Eye className="w-3.5 h-3.5 mr-1" />
              {reviewMode ? "Collapse Details" : "Review Candidate"}
            </Button>
          )}

          {pipeline.candidate.resumeUrl && (
            <a
              href={getValidResumeUrl(pipeline.candidate.resumeUrl) ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-lg text-[11px] font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" /> Resume
              </Button>
            </a>
          )}
        </div>
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
                  className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 rounded-xl transition-colors ${
                    isActive && round.type === "MANUAL_REVIEW"
                      ? "bg-purple-50/80 border border-purple-200"
                      : isActive
                        ? "bg-indigo-50/60 border border-indigo-200"
                        : "hover:bg-slate-50"
                  }`}
                >
                  {/* Status Icon */}
                  <StatusIcon status={round.status} />

                  {/* Round Type Icon */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <RoundIcon
                      className={`w-4 h-4 ${
                        isActive ? "text-indigo-600" : "text-slate-500"
                      }`}
                    />
                  </div>

                  {/* Round Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          isActive ? "text-slate-900" : "text-slate-700"
                        }`}
                      >
                        {round.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">
                        {round.type}
                      </span>
                    </div>

                    {/* Score & Feedback */}
                    {(round.score !== null || round.feedback) && (
                      <div className="flex items-center gap-3 mt-1">
                        {round.score !== null && (
                          <span className="text-[11px] text-slate-600">
                            Score:{" "}
                            <span className="font-bold text-slate-900">{round.score}</span>
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
                      <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
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

                  {/* Round Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {round.type === "ASSESSMENT" &&
                      ["ACTIVE", "PASSED", "FAILED"].includes(round.status) && (
                        <a
                          href={`/assessment/${pipeline.candidate.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-lg text-[11px] font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            {round.status === "ACTIVE" ? "View Assessment" : "View Result"}
                          </Button>
                        </a>
                      )}

                    {round.type === "AI_INTERVIEW" &&
                      ["ACTIVE", "PASSED", "FAILED"].includes(round.status) && (
                        <a
                          href={
                            round.status === "ACTIVE"
                              ? `/interview/${pipeline.candidate.id}`
                              : `/interview/${pipeline.candidate.id}?view=summary`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 rounded-lg text-[11px] font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            {round.status === "ACTIVE"
                              ? "View Interview"
                              : "View Result"}
                          </Button>
                        </a>
                      )}

                    {isActive && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCompleteDialog(index, "PASSED")}
                          className="h-8 px-3 rounded-lg text-[11px] font-bold border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pass
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCompleteDialog(index, "FAILED")}
                          className="h-8 px-3 rounded-lg text-[11px] font-bold border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Fail
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Screening Evaluation Detail */}
                {round.type === "RESUME_SCREENING" &&
                  round.evaluation &&
                  (round.status === "PASSED" || round.status === "FAILED") ? (
                  <ScreeningEvaluation
                    evaluation={round.evaluation as Record<string, unknown>}
                    forceExpand={reviewMode}
                  />
                ) : null}

                {/* Assessment Evaluation Detail */}
                {round.type === "ASSESSMENT" &&
                  round.evaluation &&
                  (round.status === "PASSED" || round.status === "FAILED") ? (
                  <AssessmentEvaluation
                    evaluation={round.evaluation as Record<string, unknown>}
                    forceExpand={reviewMode}
                  />
                ) : null}

                {/* Connector line */}
                {!isLast && (
                  <div className="flex items-center ml-[10px] py-0">
                    <div
                      className={`w-px h-4 ${
                        round.status === "PASSED" ? "bg-emerald-300" : "bg-slate-200"
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
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMoveTargetRoundIndex(null);
                setMoveDialogOpen(true);
              }}
              className="h-8 px-3 rounded-lg text-[11px] font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <ChevronDown className="w-3.5 h-3.5 mr-1" /> Move to Round
            </Button>
          </div>
        )}
      </div>

      {/* Complete Round Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden shadow-2xl">
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                {completeStatus === "PASSED" ? "Mark as Passed" : "Mark as Failed"}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                {activeRoundIndex !== null && pipeline && (
                  <>
                    Round: <span className="font-bold text-slate-900">{pipeline.rounds[activeRoundIndex].name}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-6">
              {dialogError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-700 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <p>{dialogError}</p>
                </div>
              )}

              {/* Score */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Score (optional)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => {
                    setScore(e.target.value);
                    if (scoreError) setScoreError(null);
                  }}
                  placeholder="0-100"
                  className={`bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 ${
                    scoreError ? "border-rose-400 focus:ring-rose-500/20" : ""
                  }`}
                />
                {scoreError && (
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">{scoreError}</p>
                )}
              </div>

              {/* Feedback */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Feedback (optional)
                </Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add feedback for this round..."
                  className="bg-slate-50 border-slate-200 text-slate-900 rounded-xl focus:ring-2 focus:ring-indigo-500/20 min-h-[80px]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCompleteDialogOpen(false)}
                className="flex-1 h-12 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleCompleteRound}
                className={`flex-1 h-12 rounded-xl font-bold shadow-md ${
                  completeStatus === "PASSED"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                    : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20"
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
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden shadow-2xl">
          <div className="p-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                Move to Round
              </DialogTitle>
              <DialogDescription className="text-slate-500">
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
                        ? "bg-indigo-50 border border-indigo-200"
                        : isCurrentActive
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <StatusIcon status={round.status} />
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <RoundIcon className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-slate-900">{round.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2 uppercase">
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
                className="flex-1 h-12 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={submitting || moveTargetRoundIndex === null}
                onClick={handleMoveToRound}
                className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20"
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


// ─── Screening Evaluation Detail Component ──────────────────────
type ScreeningEvaluationProps = {
  evaluation: Record<string, unknown>;
};

type SkillEntry = {
  skill: string;
  level: string;
  match: "match" | "partial" | "missing";
};

type ScreeningEvaluationData = {
  score: number;
  decision: string;
  summary: string;
  strengths: string[];
  missingRequirements: string[];
  skillAnalysis: SkillEntry[];
  educationMatch: string;
  experienceMatch: string;
};

const ScreeningEvaluation: React.FC<ScreeningEvaluationProps & { forceExpand?: boolean }> = ({
  evaluation,
  forceExpand = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Safely parse evaluation data
  const data = evaluation as ScreeningEvaluationData | null;
  if (!data) return null;

  const strengths = Array.isArray(data.strengths) ? data.strengths : [];
  const missing = Array.isArray(data.missingRequirements) ? data.missingRequirements : [];
  const skills = Array.isArray(data.skillAnalysis) ? data.skillAnalysis : [];

  return (
    <div className="ml-16 mt-1 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Hide" : "Show"} Screening Details
      </button>

      {(expanded || forceExpand) && (
        <div className="mt-3 space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200/80">
          {/* Summary */}
          {data.summary && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Summary
              </span>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                {data.summary}
              </p>
            </div>
          )}

          {/* Score Bar */}
          {typeof data.score === "number" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Score
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {data.score}/100
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.score >= 70
                      ? "bg-emerald-500"
                      : data.score >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, data.score))}%` }}
                />
              </div>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                Strengths
              </span>
              <div className="flex flex-wrap gap-1.5">
                {strengths.map((s, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Requirements */}
          {missing.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                Missing Requirements
              </span>
              <div className="flex flex-wrap gap-1.5">
                {missing.map((m, i) => (
                  <span
                    key={i}
                    className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-semibold"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skill Analysis */}
          {skills.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Skill Analysis
              </span>
              <div className="space-y-1">
                {skills.map((skill, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-[10px]"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        skill.match === "match"
                          ? "bg-emerald-500"
                          : skill.match === "partial"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                    />
                    <span className="text-slate-800 font-semibold min-w-[100px]">
                      {skill.skill}
                    </span>
                    <span className="text-slate-500">
                      {skill.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education & Experience */}
          <div className="grid grid-cols-2 gap-3">
            {data.educationMatch && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Education
                </span>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  {data.educationMatch}
                </p>
              </div>
            )}
            {data.experienceMatch && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Experience
                </span>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  {data.experienceMatch}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Assessment Evaluation Detail Component ─────────────────────
type AssessmentEvaluationProps = {
  evaluation: Record<string, unknown>;
};

type BreakdownEntry = {
  questionId: number;
  question: string;
  candidateAnswer: string;
  marks: number;
  maxMarks: number;
  feedback: string;
};

type GradingData = {
  totalScore: number;
  maxScore: number;
  percentage: number;
  breakdown: BreakdownEntry[];
  summary: string;
};

const AssessmentEvaluation: React.FC<AssessmentEvaluationProps & { forceExpand?: boolean }> = ({
  evaluation,
  forceExpand = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const grading = evaluation?.grading as GradingData | undefined;
  const summary = evaluation?.summary as string | undefined;
  const percentage = grading?.percentage;
  const totalScore = grading?.totalScore;
  const maxScore = grading?.maxScore;
  const breakdown = Array.isArray(grading?.breakdown) ? grading.breakdown : [];

  if (!grading) return null;

  return (
    <div className="ml-16 mt-1 mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
        {expanded ? "Hide" : "Show"} Assessment Details
      </button>

      {(expanded || forceExpand) && (
        <div className="mt-3 space-y-4 bg-slate-50 rounded-xl p-4 border border-slate-200/80">
          {/* Summary */}
          {(summary || grading.summary) && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Summary
              </span>
              <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                {summary || grading.summary}
              </p>
            </div>
          )}

          {/* Score Bar */}
          {typeof percentage === "number" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Score
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {totalScore}/{maxScore} ({percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    percentage >= 70
                      ? "bg-emerald-500"
                      : percentage >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
              </div>
            </div>
          )}

          {/* Question Breakdown */}
          {breakdown.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Question Breakdown
              </span>
              <div className="space-y-2">
                {breakdown.map((entry, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg p-3 space-y-1.5 border border-slate-200/60 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600">
                        Q{i + 1}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          entry.marks >= entry.maxMarks * 0.7
                            ? "text-emerald-700"
                            : entry.marks >= entry.maxMarks * 0.4
                            ? "text-amber-700"
                            : "text-rose-700"
                        }`}
                      >
                        {entry.marks}/{entry.maxMarks}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-700 font-medium line-clamp-2">
                      {entry.question}
                    </p>
                    {entry.feedback && (
                      <p className="text-[9px] text-slate-500 italic">
                        {entry.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

