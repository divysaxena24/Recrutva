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
import AddJobModal from "@/components/AddJobModal";
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
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
  },
  ASSESSMENT: {
    label: "Assessment",
    caption: "Skills testing",
    icon: ClipboardList,
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  AI_INTERVIEW: {
    label: "AI Interview",
    caption: "Voice interview",
    icon: Bot,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  MANUAL_REVIEW: {
    label: "Manual Review",
    caption: "Awaiting your review",
    icon: UserCheck,
    color: "text-purple-600",
    bg: "bg-purple-50",
    ring: "ring-purple-200",
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

  const loadOverview = useCallback(() => {
    return getDashboardOverview()
      .then((data) => {
        if (data === null) {
          setError(true);
        } else {
          setOverview(data);
          setError(false);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fetchOverview = useCallback(() => {
    setLoading(true);
    return loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const metrics = overview?.metrics;
  const manualReviewCount =
    overview?.pipelineStages?.find((s) => s.type === "MANUAL_REVIEW")?.count ?? 0;

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Hero Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4 text-indigo-600" /> Recruiter Command Center
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Welcome back, {user?.firstName || "Recruiter"}
          </h1>
          <p className="text-slate-600 text-lg max-w-xl">
            Real-time pipeline metrics and active candidate evaluations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 flex-wrap"
        >
          <AddJobModal onSuccess={fetchOverview} />
          <AddCandidateModal onSuccess={fetchOverview} />
        </motion.div>
      </section>

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState onRetry={fetchOverview} />
      ) : (
        <>
          {/* Action Required Alert Banner */}
          {manualReviewCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-purple-50 border border-purple-200 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {manualReviewCount} Candidate{manualReviewCount > 1 ? "s" : ""}{" "}
                    Awaiting Manual Review
                  </h4>
                  <p className="text-xs text-purple-800 font-medium">
                    Review candidate scores and move them forward in the pipeline.
                  </p>
                </div>
              </div>
              <Link href="/dashboard/candidates">
                <Button className="h-10 px-5 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 shrink-0">
                  Review Candidates <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </motion.div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard
              icon={<Briefcase className="text-indigo-600" />}
              label="Total Jobs"
              value={String(metrics?.totalJobs ?? 0)}
            />
            <StatCard
              icon={<TrendingUp className="text-sky-600" />}
              label="Active Jobs"
              value={String(metrics?.activeJobs ?? 0)}
            />
            <StatCard
              icon={<Users className="text-amber-600" />}
              label="Total Candidates"
              value={String(metrics?.totalCandidates ?? 0)}
            />
            <StatCard
              icon={<CheckCircle2 className="text-emerald-600" />}
              label="Passed"
              value={String(metrics?.passedCandidates ?? 0)}
            />
            <StatCard
              icon={<XCircle className="text-rose-600" />}
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
    <Card className="p-6 bg-white border-slate-200/80 rounded-3xl flex flex-col gap-4 group hover:border-indigo-300 transition-all cursor-default shadow-xs hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mb-2">
          {label}
        </p>
        <p className="text-3xl font-black text-slate-900 leading-none">{value}</p>
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
    <Card className="p-8 bg-white border-slate-200/80 rounded-3xl shadow-xs">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Pipeline Overview
          </h3>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
            Candidates currently in each hiring stage
          </p>
        </div>
        {totalCandidates > 0 && (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full px-4 py-2">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            {totalInPipeline} in pipeline
          </div>
        )}
      </div>

      {totalCandidates === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-14 text-slate-500">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">No candidates yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Add candidates to see your pipeline fill up.
          </p>
          <Link href="/dashboard/candidates">
            <Button className="mt-5 h-10 px-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
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
                  <div className="h-full bg-slate-50 border border-slate-200/70 rounded-2xl p-6 flex flex-col gap-4 hover:border-indigo-300 hover:bg-slate-100/50 transition-all">
                    <div
                      className={`w-10 h-10 rounded-2xl ${meta.bg} border border-slate-200 flex items-center justify-center`}
                    >
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-slate-900 leading-none">
                        {stage.count}
                      </p>
                      <p className="text-xs text-slate-700 font-bold uppercase tracking-wider mt-2">
                        {meta.label}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">
                        {meta.caption}
                      </p>
                    </div>
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex items-center justify-center py-1 lg:py-0">
                    <ArrowRight className="w-5 h-5 text-slate-300 hidden lg:block" />
                    <ArrowDown className="w-5 h-5 text-slate-300 lg:hidden" />
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
    <Card className="p-8 bg-white border-slate-200/80 rounded-3xl shadow-xs h-fit">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-slate-900 tracking-tight">
            Job Performance
          </h3>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-1">
            Applicants and activity per job
          </p>
        </div>
        <Link
          href="/dashboard/jobs"
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-4">
            <Briefcase className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">No jobs created yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Create your first job posting to start hiring.
          </p>
          <Link href="/dashboard/jobs">
            <Button className="mt-5 h-10 px-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
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
                className="block rounded-2xl border border-slate-100 hover:border-indigo-200 bg-slate-50/50 hover:bg-indigo-50/30 transition-all p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {job.title}
                      </span>
                      <Badge
                        className={
                          isOpen
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            : "bg-slate-100 text-slate-600 border-slate-200 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
                      #{job.id.toString().padStart(4, "0")} ·{" "}
                      {job.location || "Remote"} · Created{" "}
                      {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-slate-600 shrink-0">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      {job.applicantCount}{" "}
                      {job.applicantCount === 1 ? "applicant" : "applicants"}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Activity className="w-3.5 h-3.5 text-amber-600" />
                      {job.activeCandidates} active
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
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
    <Card className="p-8 bg-white border-slate-200/80 rounded-3xl shadow-xs h-fit">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" /> Recent Activity
        </h3>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          Latest
        </span>
      </div>

      {events.length === 0 ? (
        <p className="text-xs text-slate-500 italic py-8 text-center">
          No activity yet. Add candidates to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {events.map((event, i) => {
            const isApplication = event.kind === "application";
            const isPassed = event.status === "PASSED";
            const Icon = isApplication
              ? Users
              : isPassed
                ? CheckCircle2
                : XCircle;
            const color = isApplication
              ? "text-indigo-600 bg-indigo-50 border-indigo-200"
              : isPassed
                ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                : "text-rose-600 bg-rose-50 border-rose-200";
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
                className="flex gap-3.5 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200/60"
              >
                <div
                  className={`mt-0.5 p-2 rounded-xl border shrink-0 ${color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-700 leading-snug font-medium">
                    <span className="font-bold text-slate-900">
                      {event.candidateName}
                    </span>{" "}
                    {action}{" "}
                    <span className="text-indigo-600 font-semibold">{event.detail}</span>
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">
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
            className="h-40 rounded-3xl bg-white border border-slate-200 animate-pulse"
          />
        ))}
      </div>
      <div className="h-64 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
        <div className="h-96 rounded-3xl bg-white border border-slate-200 animate-pulse" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-10 bg-white border border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center py-20 shadow-xs">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">Failed to load dashboard</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        We couldn&apos;t fetch your hiring overview. Please try again.
      </p>
      <Button
        onClick={onRetry}
        className="mt-6 h-11 px-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20"
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Retry
      </Button>
    </Card>
  );
}