"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  Flag,
  Play,
  RefreshCw,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCandidateApplications,
  type CandidateApplicationView,
  type CandidateNextAction,
  type CandidateStageView,
  type NextActionKind,
  type StageState,
  type StatusTone,
} from "@/app/actions/candidate-dashboard";

// ─── Stage presentation ───────────────────────────────────────────

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  application: FileText,
  RESUME_SCREENING: FileSearch,
  ASSESSMENT: ClipboardList,
  AI_INTERVIEW: Bot,
  MANUAL_REVIEW: UserCheck,
  decision: Flag,
};

const STATE_META: Record<
  StageState,
  { label: string; iconBg: string; iconColor: string; text: string }
> = {
  completed: {
    label: "Completed",
    iconBg: "bg-emerald-500/10 ring-emerald-500/30",
    iconColor: "text-emerald-400",
    text: "text-emerald-500/80",
  },
  current: {
    label: "In Progress",
    iconBg: "bg-indigo-500/10 ring-indigo-500/30",
    iconColor: "text-indigo-400",
    text: "text-indigo-400",
  },
  upcoming: {
    label: "Upcoming",
    iconBg: "bg-white/[0.03] ring-white/10",
    iconColor: "text-slate-500",
    text: "text-slate-600",
  },
  failed: {
    label: "Not Progressing",
    iconBg: "bg-rose-500/10 ring-rose-500/30",
    iconColor: "text-rose-400",
    text: "text-rose-400",
  },
  skipped: {
    label: "Skipped",
    iconBg: "bg-white/[0.03] ring-white/10",
    iconColor: "text-slate-500",
    text: "text-slate-600",
  },
  "not-available": {
    label: "Not Available",
    iconBg: "bg-white/[0.02] ring-white/5",
    iconColor: "text-slate-700",
    text: "text-slate-700",
  },
};

const TONE_BADGE: Record<StatusTone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const ACCENT = {
  indigo: {
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    ring: "ring-indigo-500/20",
    btn: "bg-indigo-600 hover:bg-indigo-500",
  },
  emerald: {
    text: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
    btn: "bg-emerald-600 hover:bg-emerald-500",
  },
  amber: {
    text: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
    btn: "bg-amber-600 hover:bg-amber-500",
  },
  purple: {
    text: "text-purple-400",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
    btn: "bg-purple-600 hover:bg-purple-500",
  },
  rose: {
    text: "text-rose-400",
    bg: "bg-rose-500/10",
    ring: "ring-rose-500/20",
    btn: "bg-rose-600 hover:bg-rose-500",
  },
  slate: {
    text: "text-slate-400",
    bg: "bg-white/[0.03]",
    ring: "ring-white/10",
    btn: "bg-slate-700 hover:bg-slate-600",
  },
};

const NEXT_ACTION_META: Record<
  NextActionKind,
  { icon: React.ComponentType<{ className?: string }>; accent: keyof typeof ACCENT }
> = {
  assessment: { icon: ClipboardCheck, accent: "indigo" },
  interview: { icon: Play, accent: "emerald" },
  "manual-review": { icon: UserCheck, accent: "purple" },
  "in-review": { icon: FileSearch, accent: "amber" },
  complete: { icon: CheckCircle2, accent: "emerald" },
  "not-progressing": { icon: XCircle, accent: "rose" },
  missed: { icon: Calendar, accent: "rose" },
};

export default function CandidateDashboardPage() {
  const [applications, setApplications] = useState<
    CandidateApplicationView[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getCandidateApplications();
      setApplications(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();

    // Live status refresh (keeps scheduled/interview state current).
    const interval = setInterval(() => {
      getCandidateApplications()
        .then(setApplications)
        .catch(() => {
          // Keep last known data on transient failures.
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchApplications]);

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Users className="w-4 h-4" /> Candidate Portal
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Welcome Back!
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Track your applications and see exactly where you are in the hiring
            process.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/jobs">
            <Button className="h-12 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
              Explore More Jobs <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState onRetry={fetchApplications} />
      ) : (
        <>
          <SummaryCards applications={applications ?? []} />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Your Applications
              </h3>
              <Badge
                variant="outline"
                className="border-slate-800 text-slate-500"
              >
                Live Status
              </Badge>
            </div>

            {applications && applications.length === 0 ? (
              <EmptyState />
            ) : (
              (applications ?? []).map((app, i) => (
                <ApplicationCard key={app.id} app={app} index={i} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function SummaryCards({
  applications,
}: {
  applications: CandidateApplicationView[];
}) {
  const total = applications.length;
  const completed = applications.filter(
    (a) => a.nextAction.kind === "complete"
  ).length;
  const inProgress = total - completed;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <Card className="bg-emerald-600/5 border-emerald-500/20 p-6 rounded-3xl">
        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4">
          Total Applications
        </h3>
        <div className="text-5xl font-black text-white">{total}</div>
      </Card>
      <Card className="bg-indigo-600/5 border-indigo-500/20 p-6 rounded-3xl">
        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">
          In Progress
        </h3>
        <div className="text-5xl font-black text-white">{inProgress}</div>
      </Card>
      <Card className="bg-slate-600/5 border-slate-700/20 p-6 rounded-3xl">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
          Completed
        </h3>
        <div className="text-5xl font-black text-white">{completed}</div>
      </Card>
    </div>
  );
}

function ApplicationCard({
  app,
  index,
}: {
  app: CandidateApplicationView;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className="bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] p-6 lg:p-8 ring-1 ring-white/5 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6 text-slate-400" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-white break-words">
                {app.jobTitle}
              </h4>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Applied{" "}
                  {new Date(app.createdAt).toLocaleDateString()}
                </span>
                {app.scheduledAt && (
                  <span className="flex items-center gap-1 text-indigo-500/70">
                    <Calendar className="w-3 h-3" />{" "}
                    {new Date(app.scheduledAt).toLocaleString()}
                  </span>
                )}
                {app.score && (
                  <span className="flex items-center gap-1 text-emerald-500/80">
                    <CheckCircle2 className="w-3 h-3" /> AI Score {app.score}
                    /100
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge
            className={`px-3 py-1 rounded-full border shrink-0 ${TONE_BADGE[app.statusTone]}`}
          >
            {app.status}
          </Badge>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Pipeline Progress
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {app.progressPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${app.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Body: timeline + next action */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pt-2">
          <div className="lg:col-span-3">
            <PipelineTimeline stages={app.stages} />
          </div>
          <div className="lg:col-span-2">
            <NextActionPanel action={app.nextAction} />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function PipelineTimeline({ stages }: { stages: CandidateStageView[] }) {
  return (
    <div>
      {stages.map((stage, i) => {
        const Icon = STAGE_ICONS[stage.type] ?? Flag;
        const isLast = i === stages.length - 1;
        const meta = STATE_META[stage.status];
        const dimmed = stage.status === "not-available";
        const connectorDone =
          stage.status === "completed" || stage.status === "skipped";

        return (
          <div key={`${stage.type}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center ring-1 shrink-0 ${meta.iconBg} ${dimmed ? "opacity-40" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 ${meta.iconColor} ${dimmed ? "opacity-40" : ""}`}
                />
              </div>
              {!isLast && (
                <div
                  className={`w-px flex-1 my-1 ${connectorDone ? "bg-emerald-500/30" : "bg-slate-800"}`}
                />
              )}
            </div>
            <div
              className={`pb-5 pt-1 min-w-0 ${dimmed ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-white truncate">
                  {stage.name}
                </p>
                {stage.status === "current" && (
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 ring-1 ring-indigo-500/20 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Current
                  </span>
                )}
              </div>
              <p
                className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${meta.text}`}
              >
                {meta.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NextActionPanel({ action }: { action: CandidateNextAction }) {
  const meta = NEXT_ACTION_META[action.kind];
  const Icon = meta.icon;
  const accent = ACCENT[meta.accent];

  return (
    <div
      className={`h-full rounded-3xl p-5 ring-1 ${accent.bg} ${accent.ring} flex flex-col justify-between gap-4`}
    >
      <div className="space-y-3">
        <div
          className={`w-10 h-10 rounded-2xl ${accent.bg} ring-1 ${accent.ring} flex items-center justify-center`}
        >
          <Icon className={`w-5 h-5 ${accent.text}`} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
            What&apos;s next?
          </p>
          <p className={`text-base font-bold leading-snug ${accent.text}`}>
            {action.label}
          </p>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            {action.description}
          </p>
        </div>
      </div>
      {action.href && (
        <Link href={action.href} className="w-full">
          <Button
            className={`w-full h-11 rounded-xl font-bold text-white shadow-lg ${accent.btn}`}
          >
            {action.kind === "interview" ? (
              <>
                <Play className="w-4 h-4 mr-2 fill-current" /> Start Interview
              </>
            ) : action.kind === "assessment" ? (
              <>
                <ClipboardCheck className="w-4 h-4 mr-2" /> Start Assessment
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </Link>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-36 rounded-3xl bg-[#0a0a0f] border border-slate-800/60 ring-1 ring-white/5 animate-pulse"
          />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-72 rounded-[2rem] bg-[#0a0a0f] border border-slate-800/60 ring-1 ring-white/5 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="bg-[#0a0a0f] border-slate-800/60 p-12 text-center rounded-[2.5rem] ring-1 ring-white/5">
      <div className="w-16 h-16 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 flex items-center justify-center mx-auto mb-5">
        <Briefcase className="w-8 h-8 text-slate-600" />
      </div>
      <p className="text-slate-400 font-bold">
        You haven&apos;t applied to any jobs yet.
      </p>
      <p className="text-xs text-slate-600 mt-2">
        Browse open roles and submit your first application to get started.
      </p>
      <Link href="/jobs" className="inline-block">
        <Button className="mt-6 h-11 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20">
          Browse Open Roles <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-10 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 flex flex-col items-center justify-center text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-400" />
      </div>
      <h3 className="text-lg font-bold text-white">
        Couldn&apos;t load your applications
      </h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        Something went wrong while fetching your applications. Please try
        again.
      </p>
      <Button
        onClick={onRetry}
        className="mt-6 h-11 px-6 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/20"
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Retry
      </Button>
    </Card>
  );
}