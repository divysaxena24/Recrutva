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
    iconBg: "bg-emerald-50 ring-emerald-200",
    iconColor: "text-emerald-600",
    text: "text-emerald-700",
  },
  current: {
    label: "In Progress",
    iconBg: "bg-indigo-50 ring-indigo-200",
    iconColor: "text-indigo-600",
    text: "text-indigo-700",
  },
  upcoming: {
    label: "Upcoming",
    iconBg: "bg-slate-100 ring-slate-200",
    iconColor: "text-slate-400",
    text: "text-slate-500",
  },
  failed: {
    label: "Not Progressing",
    iconBg: "bg-rose-50 ring-rose-200",
    iconColor: "text-rose-600",
    text: "text-rose-700",
  },
  skipped: {
    label: "Skipped",
    iconBg: "bg-slate-100 ring-slate-200",
    iconColor: "text-slate-400",
    text: "text-slate-500",
  },
  "not-available": {
    label: "Not Available",
    iconBg: "bg-slate-50 ring-slate-100",
    iconColor: "text-slate-300",
    text: "text-slate-400",
  },
};

const TONE_BADGE: Record<StatusTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

const ACCENT = {
  indigo: {
    text: "text-indigo-700",
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
    btn: "bg-indigo-600 hover:bg-indigo-700",
  },
  emerald: {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    btn: "bg-emerald-600 hover:bg-emerald-700",
  },
  amber: {
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    btn: "bg-amber-600 hover:bg-amber-700",
  },
  purple: {
    text: "text-purple-700",
    bg: "bg-purple-50",
    ring: "ring-purple-200",
    btn: "bg-purple-600 hover:bg-purple-700",
  },
  rose: {
    text: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    btn: "bg-rose-600 hover:bg-rose-700",
  },
  slate: {
    text: "text-slate-700",
    bg: "bg-slate-100",
    ring: "ring-slate-200",
    btn: "bg-indigo-600 hover:bg-indigo-700 text-white",
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

  const loadApplications = useCallback(() => {
    return getCandidateApplications()
      .then((data) => {
        setApplications(data);
        setError(false);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fetchApplications = useCallback(() => {
    setLoading(true);
    return loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    loadApplications();

    const interval = setInterval(() => {
      getCandidateApplications()
        .then(setApplications)
        .catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, [loadApplications]);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1.5">
            <Users className="w-4 h-4" /> Candidate Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome Back!
          </h1>
          <p className="text-slate-600 text-base max-w-xl">
            Track your applications and see exactly where you are in the hiring
            process.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/jobs">
            <Button className="h-12 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs">
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
              <h3 className="text-xl font-bold text-slate-900">
                Your Applications
              </h3>
              <Badge
                variant="outline"
                className="border-slate-200 text-slate-500 bg-white"
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
  const actionRequired = applications.filter(
    (a) => a.nextAction.kind === "interview" || a.nextAction.kind === "assessment"
  ).length;
  const completed = applications.filter(
    (a) => a.nextAction.kind === "complete"
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <Card className="bg-white border-slate-200/80 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-emerald-600" /> Total Applications
        </h3>
        <div className="text-4xl font-black text-slate-900">{total}</div>
      </Card>
      <Card
        className={`p-6 rounded-3xl border flex flex-col justify-between transition-all shadow-xs ${
          actionRequired > 0
            ? "bg-amber-50/80 border-amber-200"
            : "bg-white border-slate-200/80"
        }`}
      >
        <h3
          className={`text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 ${
            actionRequired > 0 ? "text-amber-700" : "text-slate-500"
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 ${
              actionRequired > 0 ? "text-amber-600 animate-pulse" : "text-slate-400"
            }`}
          />
          Action Required
        </h3>
        <div className="text-4xl font-black text-slate-900">{actionRequired}</div>
      </Card>
      <Card className="bg-white border-slate-200/80 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Completed
        </h3>
        <div className="text-4xl font-black text-slate-900">{completed}</div>
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="bg-white border-slate-200/80 rounded-3xl p-6 lg:p-8 shadow-xs space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6 text-slate-500" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-slate-900 break-words text-lg">
                {app.jobTitle}
              </h4>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Applied{" "}
                  {new Date(app.createdAt).toLocaleDateString()}
                </span>
                {app.scheduledAt && (
                  <span className="flex items-center gap-1 text-indigo-600">
                    <Calendar className="w-3 h-3" />{" "}
                    {new Date(app.scheduledAt).toLocaleString()}
                  </span>
                )}
                {app.score && (
                  <span className="flex items-center gap-1 text-emerald-600">
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
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
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
                  className={`w-px flex-1 my-1 ${connectorDone ? "bg-emerald-400" : "bg-slate-200"}`}
                />
              )}
            </div>
            <div
              className={`pb-5 pt-1 min-w-0 ${dimmed ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {stage.name}
                </p>
                {stage.status === "current" && (
                  <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
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
      className={`h-full rounded-2xl p-5 border ${accent.bg} ${accent.ring} flex flex-col justify-between gap-4`}
    >
      <div className="space-y-3">
        <div
          className={`w-10 h-10 rounded-2xl ${accent.bg} border ${accent.ring} flex items-center justify-center`}
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
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            {action.description}
          </p>
        </div>
      </div>
      {action.href && (
        <Link href={action.href} className="w-full">
          <Button
            className={`w-full h-11 rounded-xl font-bold text-white shadow-xs ${accent.btn}`}
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
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-36 rounded-3xl bg-white border border-slate-200/80 animate-pulse"
          />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-72 rounded-3xl bg-white border border-slate-200/80 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="bg-white border-slate-200/80 p-12 text-center rounded-3xl shadow-xs">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
        <Briefcase className="w-8 h-8 text-slate-400" />
      </div>
      <p className="text-slate-900 font-bold text-base">
        You haven&apos;t applied to any jobs yet.
      </p>
      <p className="text-xs text-slate-500 mt-2">
        Browse open roles and submit your first application to get started.
      </p>
      <Link href="/jobs" className="inline-block">
        <Button className="mt-6 h-11 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs">
          Browse Open Roles <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-10 bg-white border-slate-200/80 rounded-3xl shadow-xs flex flex-col items-center justify-center text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">
        Couldn&apos;t load your applications
      </h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        Something went wrong while fetching your applications. Please try
        again.
      </p>
      <Button
        onClick={onRetry}
        className="mt-6 h-11 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs"
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Retry
      </Button>
    </Card>
  );
}