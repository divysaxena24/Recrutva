"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Bot,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileSearch,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddCandidateModal from "@/components/AddCandidateModal";
import {
  getDashboardOverview,
  type DashboardOverview,
  type DashboardActivityEvent,
  type DashboardJobRow,
  type PipelineStageType,
} from "@/app/actions/dashboard";

const STAGE_META: Record<
  PipelineStageType,
  {
    label: string;
    caption: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    ring: string;
  }
> = {
  RESUME_SCREENING: {
    label: "Resume Screening",
    caption: "AI resume evaluation",
    icon: FileSearch,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    ring: "ring-indigo-500/20",
  },
  ASSESSMENT: {
    label: "Assessment",
    caption: "Skills testing",
    icon: ClipboardList,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  AI_INTERVIEW: {
    label: "AI Interview",
    caption: "Voice interview",
    icon: Bot,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  MANUAL_REVIEW: {
    label: "Manual Review",
    caption: "Awaiting your review",
    icon: UserCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
  },
};

function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getDashboardOverview();
      if (data === null) {
        setError(true);
      } else {
        setOverview(data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const metrics = overview?.metrics;

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Hero Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4" /> Hiring Command Center
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.firstName || "Recruiter"}
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Your hiring pipeline at a glance.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <Link href="/dashboard/candidates">
            <Button
              variant="outline"
              className="h-12 px-5 rounded-full border-slate-800 text-slate-300 hover:bg-white/5 text-sm font-bold"
            >
              <Users className="w-4 h-4 mr-2" /> Candidates
            </Button>
          </Link>
          <Link href="/dashboard/jobs">
            <Button
              variant="outline"
              className="h-12 px-5 rounded-full border-slate-800 text-slate-300 hover:bg-white/5 text-sm font-bold"
            >
              <Briefcase className="w-4 h-4 mr-2" /> Jobs
            </Button>
          </Link>
          <AddCandidateModal onSuccess={fetchOverview} />
        </motion.div>
      </section>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState onRetry={fetchOverview} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard
              icon={<Briefcase className="text-indigo-400" />}
              label="Total Jobs"
              value={String(metrics?.totalJobs ?? 0)}
            />
            <StatCard
              icon={<TrendingUp className="text-sky-400" />}
              label="Active Jobs"
              value={String(metrics?.activeJobs ?? 0)}
            />
            <StatCard
              icon={<Users className="text-amber-400" />}
              label="Total Candidates"
              value={String(metrics?.totalCandidates ?? 0)}
            />
            <StatCard
              icon={<CheckCircle2 className="text-emerald-400" />}
              label="Passed"
              value={String(metrics?.passedCandidates ?? 0)}
            />
            <StatCard
              icon={<XCircle className="text-rose-400" />}
              label="Rejected / Failed"
              value={String(metrics?.rejectedCandidates ?? 0)}
            />
          </div>

          {/* Pipeline Overview */}
          <PipelineOverview
            stages={overview?.pipelineStages ?? []}
            totalCandidates={metrics?.totalCandidates ?? 0}
          />

          {/* Job Performance + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <JobPerformance jobs={overview?.jobs ?? []} />
            </div>
            <RecentActivity events={overview?.recentActivity ?? []} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] ring-1 ring-white/5 flex flex-col gap-4 group hover:border-indigo-500/30 transition-all cursor-default shadow-xl">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center ring-1 ring-white/5 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mb-2">
          {label}
        </p>
        <p className="text-3xl font-black text-white leading-none">{value}</p>
      </div>
    </Card>
  );
}

function PipelineOverview({
  stages,
  totalCandidates,
}: {
  stages: { type: PipelineStageType; count: number }[];
  totalCandidates: number;
}) {
  const totalInPipeline = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Pipeline Overview
          </h3>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
            Candidates currently in each hiring stage
          </p>
        </div>
        {totalCandidates > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-white/[0.03] ring-1 ring-white/5 rounded-full px-4 py-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            {totalInPipeline} in pipeline
          </div>
        )}
      </div>

      {totalCandidates === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-14 text-slate-500">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 opacity-30" />
          </div>
          <p className="text-sm font-bold text-slate-400">No candidates yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Add candidates to see your pipeline fill up.
          </p>
          <Link href="/dashboard/candidates">
            <Button className="mt-5 h-10 px-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20">
              View Candidates
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3">
          {stages.map((stage, i) => {
            const meta = STAGE_META[stage.type];
            const Icon = meta.icon;
            return (
              <Fragment key={stage.type}>
                <div className="flex-1">
                  <div className="h-full bg-white/[0.02] ring-1 ring-white/5 rounded-3xl p-6 flex flex-col gap-4 hover:ring-indigo-500/30 hover:bg-white/[0.03] transition-all">
                    <div
                      className={`w-10 h-10 rounded-2xl ${meta.bg} ring-1 ${meta.ring} flex items-center justify-center`}
                    >
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-white leading-none">
                        {stage.count}
                      </p>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                        {meta.label}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        {meta.caption}
                      </p>
                    </div>
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex items-center justify-center py-1 lg:py-0">
                    <ArrowRight className="w-5 h-5 text-slate-700 hidden lg:block" />
                    <ArrowDown className="w-5 h-5 text-slate-700 lg:hidden" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function JobPerformance({ jobs }: { jobs: DashboardJobRow[] }) {
  return (
    <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl h-fit">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">
            Job Performance
          </h3>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
            Applicants and activity per job
          </p>
        </div>
        <Link
          href="/dashboard/jobs"
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 flex items-center justify-center mb-4">
            <Briefcase className="w-7 h-7 opacity-30" />
          </div>
          <p className="text-sm font-bold text-slate-400">No jobs created yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Create your first job posting to start hiring.
          </p>
          <Link href="/dashboard/jobs">
            <Button className="mt-5 h-10 px-5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20">
              Create a Job
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isOpen = job.status === "Open";
            return (
              <Link
                key={job.id}
                href={`/dashboard/candidates?jobId=${job.id}`}
                className="block rounded-2xl border border-transparent hover:border-slate-800/60 hover:bg-white/[0.02] transition-all p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {job.title}
                      </span>
                      <Badge
                        className={
                          isOpen
                            ? "bg-emerald-500/10 text-emerald-400 border-none px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            : "bg-slate-500/10 text-slate-400 border-none px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1.5">
                      #{job.id.toString().padStart(4, "0")} ·{" "}
                      {job.location || "Remote"} · Created{" "}
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-slate-400 shrink-0">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      {job.applicantCount}{" "}
                      {job.applicantCount === 1 ? "applicant" : "applicants"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      {job.activeCandidates} active
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {job.lastActivityAt
                        ? timeAgo(job.lastActivityAt)
                        : "No activity"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RecentActivity({ events }: { events: DashboardActivityEvent[] }) {
  return (
    <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl h-fit">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" /> Recent Activity
        </h3>
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
          Latest
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-8">
          No activity yet. Add candidates to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {events.map((event, i) => {
            const isApplication = event.kind === "application";
            const isPassed = event.status === "PASSED";
            const Icon = isApplication
              ? Users
              : isPassed
                ? CheckCircle2
                : XCircle;
            const color = isApplication
              ? "text-indigo-400"
              : isPassed
                ? "text-emerald-400"
                : "text-rose-400";
            const action = isApplication
              ? "applied for"
              : isPassed
                ? "passed"
                : "failed";

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-4 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-slate-800/60"
              >
                <div
                  className={`mt-0.5 p-2 rounded-lg bg-white/[0.03] ring-1 ring-white/5 ${color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 leading-snug">
                    <span className="font-semibold text-white">
                      {event.candidateName}
                    </span>{" "}
                    {action}{" "}
                    <span className="text-indigo-400">{event.detail}</span>
                  </p>
                  <span className="text-[10px] text-slate-500 font-medium mt-1 inline-block">
                    {timeAgo(event.at)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-[2rem] bg-[#0a0a0f] border border-slate-800/60 ring-1 ring-white/5 animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 rounded-[2.5rem] bg-[#0a0a0f] border border-slate-800/60 ring-1 ring-white/5 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 h-96 rounded-[2.5rem] bg-[#0a0a0f] border border-slate-800/60 ring-1 ring-white/5 animate-pulse" />
        <div className="h-96 rounded-[2.5rem] bg-[#0a0a0f] border border-slate-800/60 ring-1 ring-white/5 animate-pulse" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-10 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 flex flex-col items-center justify-center text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-400" />
      </div>
      <h3 className="text-lg font-bold text-white">Failed to load dashboard</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        We couldn&apos;t fetch your hiring overview. Please try again.
      </p>
      <Button
        onClick={onRetry}
        className="mt-6 h-11 px-6 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20"
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Retry
      </Button>
    </Card>
  );
}