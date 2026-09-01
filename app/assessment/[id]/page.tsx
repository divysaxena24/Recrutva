"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ClipboardCheck,
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trophy,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

type Question = {
  id: number;
  question: string;
  type: string;
  maxMarks: number;
};

type AssessmentState = {
  loading: boolean;
  error: string;
  completed: boolean;
  status: string | null;
  questions: Question[];
  answers: Record<number, string>;
  currentIndex: number;
  submitting: boolean;
  result: {
    score: number;
    evaluation: unknown;
  } | null;
};

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const candidateId = params?.id as string;

  const [state, setState] = useState<AssessmentState>({
    loading: true,
    error: "",
    completed: false,
    status: null,
    questions: [],
    answers: {},
    currentIndex: 0,
    submitting: false,
    result: null,
  });

  // Load assessment
  useEffect(() => {
    if (!candidateId) return;

    const loadAssessment = async () => {
      try {
        const res = await fetch(`/api/assessment/${candidateId}`);
        const data = await res.json();

        if (!res.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            error: data.error || "Failed to load assessment",
          }));
          return;
        }

        if (data.completed) {
          setState((s) => ({
            ...s,
            loading: false,
            completed: true,
            status: data.status,
            result: {
              score: data.score,
              evaluation: data.evaluation,
            },
          }));
          return;
        }

        setState((s) => ({
          ...s,
          loading: false,
          questions: data.questions || [],
          answers: data.answers || {},
        }));
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          error: "Failed to load assessment. Please try again.",
        }));
      }
    };

    loadAssessment();
  }, [candidateId]);

  // Update answer for current question
  const updateAnswer = (questionId: number, answer: string) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: answer },
    }));
  };

  // Navigate questions
  const goToQuestion = (index: number) => {
    setState((s) => ({ ...s, currentIndex: index }));
  };

  // Submit assessment
  const handleSubmit = async () => {
    setState((s) => ({ ...s, submitting: true, error: "" }));

    try {
      const answersArray = Object.entries(state.answers).map(
        ([questionId, answer]) => ({
          questionId: parseInt(questionId, 10),
          answer,
        })
      );

      const res = await fetch(`/api/assessment/${candidateId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersArray }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState((s) => ({
          ...s,
          submitting: false,
          error: data.error || "Failed to submit assessment",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        submitting: false,
        completed: true,
        status: data.status,
        result: {
          score: data.score,
          evaluation: data.evaluation,
        },
      }));
    } catch {
      setState((s) => ({
        ...s,
        submitting: false,
        error: "Failed to submit. Please try again.",
      }));
    }
  };

  // ─── Loading State ──────────────────────────────────────────
  if (state.loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm font-medium">
            Loading your assessment...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────
  if (state.error && !state.questions.length && !state.completed) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-[#0a0a0f] border-slate-800/60 p-8 rounded-3xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">
            Unable to Load Assessment
          </h2>
          <p className="text-sm text-slate-400">{state.error}</p>
          <Button
            onClick={() => router.push("/candidate-dashboard")}
            variant="outline"
            className="border-slate-800 text-slate-400 hover:bg-white/5"
          >
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // ─── Completed State ────────────────────────────────────────
  if (state.completed && state.result) {
    const grading = state.result.evaluation as Record<string, unknown> | null;
    const breakdown = grading?.breakdown as Array<Record<string, unknown>> | undefined;
    const summary = grading?.summary as string | undefined;
    const percentage = grading?.percentage as number | undefined;
    const totalScore = grading?.totalScore as number | undefined;
    const maxScore = grading?.maxScore as number | undefined;

    return (
      <div className="min-h-screen bg-[#050505] p-6 lg:p-10">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            {state.status === "PASSED" ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            ) : (
              <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
            )}
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Assessment{" "}
              {state.status === "PASSED" ? "Completed" : "Completed"}
            </h1>
            <Badge
              variant="outline"
              className={
                state.status === "PASSED"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-4 py-1 rounded-full text-sm font-bold"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20 px-4 py-1 rounded-full text-sm font-bold"
              }
            >
              {state.status === "PASSED" ? "PASSED" : "FAILED"}
            </Badge>
          </div>

          {/* Score Card */}
          <Card className="bg-[#0a0a0f] border-slate-800/60 p-8 rounded-3xl">
            <div className="text-center space-y-4">
              <div className="text-6xl font-black text-white">
                {percentage ?? state.result.score}
                <span className="text-2xl text-slate-500">%</span>
              </div>
              {totalScore !== undefined && maxScore !== undefined && (
                <p className="text-sm text-slate-400">
                  Score: {totalScore} / {maxScore} marks
                </p>
              )}
              {summary && (
                <p className="text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                  {summary}
                </p>
              )}
            </div>
          </Card>

          {/* Breakdown */}
          {breakdown && breakdown.length > 0 && (
            <Card className="bg-[#0a0a0f] border-slate-800/60 rounded-3xl overflow-hidden">
              <div className="px-8 py-5 border-b border-slate-800/40">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                  Question Breakdown
                </h3>
              </div>
              <div className="divide-y divide-slate-800/40">
                {breakdown.map((entry, i) => (
                  <div key={i} className="px-8 py-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        Q{i + 1}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {entry.marks as number} / {entry.maxMarks as number}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      {entry.question as string}
                    </p>
                    <div className="bg-slate-900/50 rounded-xl p-3">
                      <p className="text-[11px] text-slate-500 font-bold uppercase mb-1">
                        Your Answer
                      </p>
                      <p className="text-xs text-slate-400">
                        {(entry.candidateAnswer as string) || "(No answer)"}
                      </p>
                    </div>
                    {typeof entry.feedback === "string" && entry.feedback ? (
                      <div className="bg-indigo-500/5 rounded-xl p-3">
                        <p className="text-[11px] text-indigo-400 font-bold uppercase mb-1">
                          Feedback
                        </p>
                        <p className="text-xs text-slate-400">
                          {entry.feedback}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="text-center">
            <Button
              onClick={() => router.push("/candidate-dashboard")}
              className="bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold px-8"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Assessment Active State ────────────────────────────────
  const currentQuestion = state.questions[state.currentIndex];
  const totalQuestions = state.questions.length;
  const answeredCount = Object.keys(state.answers).filter(
    (k) => state.answers[parseInt(k)]?.trim().length > 0
  ).length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#050505] p-6 lg:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest">
              <ClipboardCheck className="w-4 h-4" /> Assessment
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Technical Assessment
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-bold uppercase">
              Progress
            </div>
            <div className="text-sm font-bold text-white">
              {answeredCount}/{totalQuestions} answered
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Question Navigator */}
        <div className="flex flex-wrap gap-2">
          {state.questions.map((q, i) => {
            const isAnswered =
              state.answers[q.id]?.trim().length > 0;
            const isCurrent = i === state.currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => goToQuestion(i)}
                className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                  isCurrent
                    ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                    : isAnswered
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800/50 text-slate-500 hover:bg-slate-800"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Current Question */}
        {currentQuestion && (
          <Card className="bg-[#0a0a0f] border-slate-800/60 p-8 rounded-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full uppercase">
                  Q{state.currentIndex + 1}
                </span>
                <Badge
                  variant="outline"
                  className="bg-slate-500/10 text-slate-400 border-slate-500/20 text-[10px] font-bold uppercase"
                >
                  {currentQuestion.type}
                </Badge>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                {currentQuestion.maxMarks} marks
              </span>
            </div>

            <p className="text-base text-white leading-relaxed font-medium">
              {currentQuestion.question}
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Your Answer
              </label>
              <Textarea
                value={state.answers[currentQuestion.id] || ""}
                onChange={(e) =>
                  updateAnswer(currentQuestion.id, e.target.value)
                }
                placeholder="Type your answer here..."
                className="bg-slate-950 border-slate-800 rounded-xl min-h-[160px] text-sm text-slate-200 focus:ring-indigo-500/30"
              />
            </div>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(state.currentIndex - 1)}
            disabled={state.currentIndex === 0}
            className="border-slate-800 text-slate-400 hover:bg-white/5 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          {state.currentIndex < totalQuestions - 1 ? (
            <Button
              onClick={() => goToQuestion(state.currentIndex + 1)}
              className="bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold"
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={state.submitting}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold shadow-lg shadow-emerald-500/20"
            >
              {state.submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit Assessment
            </Button>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs text-rose-400">{state.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
