"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Send,
  Loader2,
  Code2,
  Cpu,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { SecureAssessmentShell } from "@/components/SecureAssessmentShell";
import type { SecureRoundConfig } from "@/lib/assessment-security";

type QuestionCategory = "DSA" | "OS" | "DBMS" | "OOPS";

interface TechnicalQuestion {
  id: number;
  category: QuestionCategory;
  question: string;
  maxMarks: number;
}

interface InterviewState {
  loading: boolean;
  error: string;
  completed: boolean;
  status: string | null;
  candidateRoundId: number | null;
  jobTitle: string;
  config: SecureRoundConfig;
  questions: TechnicalQuestion[];
  answers: Record<number, string>;
  currentIndex: number;
  submitting: boolean;
  result: {
    score: number;
    summary: string;
    breakdown: Array<{
      questionId: number;
      category: string;
      question: string;
      candidateAnswer: string;
      marks: number;
      maxMarks: number;
      feedback: string;
    }>;
  } | null;
}

const CATEGORY_META: Record<QuestionCategory, { label: string; icon: React.ComponentType<{ className?: string }>; badge: string }> = {
  DSA: { label: "DSA", icon: Code2, badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  OS: { label: "OS", icon: Cpu, badge: "bg-purple-50 text-purple-700 border-purple-200" },
  DBMS: { label: "DBMS", icon: Database, badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OOPS: { label: "OOPS", icon: Layers, badge: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function TechnicalInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = params?.id as string;
  const requestedView = searchParams.get("view");

  const [state, setState] = useState<InterviewState>({
    loading: true,
    error: "",
    completed: false,
    status: null,
    candidateRoundId: null,
    jobTitle: "Software Development Engineer",
    config: { secureMode: true, requireFullscreen: true, maxViolations: 3 },
    questions: [],
    answers: {},
    currentIndex: 0,
    submitting: false,
    result: null,
  });

  const [confirmUnanswered, setConfirmUnanswered] = useState(false);

  // Load interview questions & candidate round session
  useEffect(() => {
    if (!candidateId) return;

    const loadInterview = async () => {
      try {
        const res = await fetch(`/api/interview/questions?candidateId=${candidateId}`);
        const data = await res.json();

        if (!res.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            error: data.error || "Failed to load technical interview session",
          }));
          return;
        }

        // Check if candidate already completed this interview
        if (data.status === "Completed" || data.completed) {
          setState((s) => ({
            ...s,
            loading: false,
            completed: true,
            status: data.status || "Completed",
            result: data.analysis || data.result || null,
          }));
          return;
        }

        // Format 10 questions (1 DSA, 3 OS, 3 DBMS, 3 OOPS)
        let formattedQuestions: TechnicalQuestion[] = [];
        if (Array.isArray(data.questions)) {
          formattedQuestions = data.questions;
        } else if (Array.isArray(data)) {
          formattedQuestions = data.map((q: unknown, idx: number) => {
            const item = typeof q === "object" && q !== null ? (q as Record<string, unknown>) : {};
            let category: QuestionCategory = "DSA";
            if (idx >= 1 && idx <= 3) category = "OS";
            else if (idx >= 4 && idx <= 6) category = "DBMS";
            else if (idx >= 7) category = "OOPS";

            return {
              id: idx + 1,
              category,
              question: (item.question as string) || (item.text as string) || `Technical question ${idx + 1}`,
              maxMarks: 10,
            };
          });
        }

        setState((s) => ({
          ...s,
          loading: false,
          candidateRoundId: data.candidateRoundId || parseInt(candidateId, 10),
          jobTitle: data.jobTitle || "Software Engineer",
          config: data.config || s.config,
          questions: formattedQuestions,
          answers: data.answers || {},
        }));
      } catch (err) {
        console.error("Error loading technical interview:", err);
        setState((s) => ({
          ...s,
          loading: false,
          error: "Failed to load interview session. Please try again.",
        }));
      }
    };

    loadInterview();
  }, [candidateId]);

  // Update answer for current question
  const updateAnswer = (questionId: number, text: string) => {
    setState((s) => ({
      ...s,
      answers: { ...s.answers, [questionId]: text },
    }));
  };

  const goToQuestion = (index: number) => {
    setState((s) => ({ ...s, currentIndex: index }));
  };

  // Submit Technical Interview
  const handleSubmit = async () => {
    const unanswered = state.questions.filter(
      (q) => !state.answers[q.id] || state.answers[q.id].trim().length === 0
    );

    if (unanswered.length > 0 && !confirmUnanswered) {
      setConfirmUnanswered(true);
      setState((s) => ({
        ...s,
        error: `You have ${unanswered.length} unanswered question(s). Click "Confirm & Submit" to submit anyway.`,
      }));
      return;
    }

    setConfirmUnanswered(false);
    setState((s) => ({ ...s, submitting: true, error: "" }));

    try {
      const answersList = Object.entries(state.answers).map(([qId, ans]) => ({
        questionId: parseInt(qId, 10),
        answer: ans,
      }));

      const res = await fetch(`/api/interview/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: candidateId,
          questions: state.questions,
          transcript: JSON.stringify(answersList),
          answers: answersList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState((s) => ({
          ...s,
          submitting: false,
          error: data.error || "Failed to submit interview",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        submitting: false,
        completed: true,
        status: data.evaluation?.totalScore >= 50 ? "PASSED" : "FAILED",
        result: data.evaluation,
      }));
    } catch {
      setState((s) => ({
        ...s,
        submitting: false,
        error: "Failed to submit interview. Please check your connection and try again.",
      }));
    }
  };

  // ─── Loading View ────────────────────────────────────────────────
  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
          <p className="text-slate-600 text-sm font-medium">
            Preparing your technical interview environment...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error View ──────────────────────────────────────────────────
  if (state.error && !state.questions.length && !state.completed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <Card className="max-w-md w-full bg-white border border-slate-200/80 p-8 rounded-3xl text-center space-y-4 shadow-xs">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Unable to Open Interview</h2>
          <p className="text-sm text-slate-600">{state.error}</p>
          <Button
            onClick={() => router.push("/candidate-dashboard")}
            variant="outline"
            className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            Back to Candidate Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  // ─── Completed View ──────────────────────────────────────────────
  if (state.completed || requestedView === "summary") {
    const score = state.result?.score ?? 0;
    const summary = state.result?.summary ?? "Technical evaluation completed.";
    const breakdown = state.result?.breakdown ?? [];
    const isPassed = state.status === "PASSED" || score >= 50;

    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-10 font-sans">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            {isPassed ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
            ) : (
              <XCircle className="w-16 h-16 text-rose-600 mx-auto" />
            )}
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Technical Interview Completed
            </h1>
            <Badge
              variant="outline"
              className={
                isPassed
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 px-4 py-1 rounded-full text-sm font-bold"
                  : "bg-rose-50 text-rose-700 border-rose-200 px-4 py-1 rounded-full text-sm font-bold"
              }
            >
              {isPassed ? "PASSED" : "FAILED"}
            </Badge>
          </div>

          <Card className="bg-white border border-slate-200/80 p-8 rounded-3xl shadow-xs text-center space-y-4">
            <div className="text-6xl font-black text-slate-900">
              {score}
              <span className="text-2xl text-slate-400">%</span>
            </div>
            <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              {summary}
            </p>
          </Card>

          {breakdown.length > 0 && (
            <Card className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                  Detailed Question Evaluation
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {breakdown.map((item, idx) => (
                  <div key={idx} className="px-8 py-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          Q{idx + 1}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">
                          {item.category}
                        </Badge>
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {item.marks} / {item.maxMarks} marks
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{item.question}</p>
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3">
                      <p className="text-[11px] text-slate-500 font-bold uppercase mb-1">Your Answer</p>
                      <p className="text-xs text-slate-700">{item.candidateAnswer || "(No answer)"}</p>
                    </div>
                    {item.feedback && (
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3">
                        <p className="text-[11px] text-indigo-700 font-bold uppercase mb-1">Feedback</p>
                        <p className="text-xs text-indigo-950">{item.feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="text-center">
            <Button
              onClick={() => router.push("/candidate-dashboard")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold px-8 shadow-md shadow-indigo-600/15"
            >
              Back to Candidate Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active Technical Interview View ─────────────────────────────
  const currentQuestion = state.questions[state.currentIndex];
  const totalQuestions = state.questions.length;
  const answeredCount = Object.keys(state.answers).filter(
    (k) => state.answers[parseInt(k, 10)]?.trim().length > 0
  ).length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const categoryMeta = currentQuestion ? CATEGORY_META[currentQuestion.category] || CATEGORY_META.DSA : CATEGORY_META.DSA;
  const CategoryIcon = categoryMeta.icon;

  return (
    <SecureAssessmentShell
      candidateRoundId={state.candidateRoundId || parseInt(candidateId, 10)}
      roundTitle={`Technical Interview — ${state.jobTitle}`}
      config={state.config}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest">
              <Sparkles className="w-4 h-4" /> AI Technical Evaluation (SDE Profile)
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Question {state.currentIndex + 1} of {totalQuestions}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500 font-bold uppercase">Progress</div>
            <div className="text-sm font-bold text-slate-900">
              {answeredCount}/{totalQuestions} answered
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Category Pills & Question Navigator */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mr-1">Rounds:</span>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">1 DSA</Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">3 OS</Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">3 DBMS</Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">3 OOPS</Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {state.questions.map((q, i) => {
              const isAnswered = state.answers[q.id]?.trim().length > 0;
              const isCurrent = i === state.currentIndex;
              return (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/30"
                      : isAnswered
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question */}
        {currentQuestion && (
          <Card className="bg-white border border-slate-200/80 p-8 rounded-3xl space-y-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full uppercase">
                  Q{state.currentIndex + 1}
                </span>
                <Badge variant="outline" className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1.5 ${categoryMeta.badge}`}>
                  <CategoryIcon className="w-3.5 h-3.5" />
                  {currentQuestion.category}
                </Badge>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                {currentQuestion.maxMarks} marks
              </span>
            </div>

            <p className="text-base text-slate-900 leading-relaxed font-medium">
              {currentQuestion.question}
            </p>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-widest flex items-center justify-between">
                <span>Your Technical Answer (Type response below)</span>
                <span className="text-[10px] text-slate-400 font-normal">Plain text supported</span>
              </label>
              <Textarea
                value={state.answers[currentQuestion.id] || ""}
                onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                placeholder={`Type your detailed explanation for this ${currentQuestion.category} question...`}
                className="bg-white border-slate-200 rounded-2xl min-h-[200px] text-sm text-slate-900 focus:ring-indigo-500/20 shadow-xs leading-relaxed font-sans"
              />
            </div>
          </Card>
        )}

        {/* Navigation & Submission Controls */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => goToQuestion(state.currentIndex - 1)}
            disabled={state.currentIndex === 0}
            className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          {state.currentIndex < totalQuestions - 1 ? (
            <Button
              onClick={() => goToQuestion(state.currentIndex + 1)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/15"
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={state.submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/15"
            >
              {state.submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {confirmUnanswered ? "Confirm & Submit" : "Submit Technical Interview"}
            </Button>
          )}
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-xs text-rose-700 font-medium">{state.error}</span>
          </div>
        )}
      </div>
    </SecureAssessmentShell>
  );
}
