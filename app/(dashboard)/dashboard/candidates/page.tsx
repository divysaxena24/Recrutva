"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  FileSearch,
  FileText,
  Filter,
  Inbox,
  LayoutGrid,
  MoreVertical,
  RefreshCw,
  Search,
  Table2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import CandidatePipelineCard from "@/components/CandidatePipelineCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AddCandidateModal from "@/components/AddCandidateModal";
import EditCandidateModal from "@/components/EditCandidateModal";
import { getCandidates } from "@/app/actions/candidate";
import { getJobById } from "@/app/actions/job";

/** A candidate row as returned by the getCandidates server action. */
type CandidateRow = Awaited<ReturnType<typeof getCandidates>>[number];

const STATUS_FILTERS = ["All", "Scheduled", "Completed", "Missed"] as const;

const STAGE_ORDER = [
  "RESUME_SCREENING",
  "ASSESSMENT",
  "AI_INTERVIEW",
  "MANUAL_REVIEW",
] as const;

const STAGE_META: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    ring: string;
  }
> = {
  RESUME_SCREENING: {
    label: "Resume Screening",
    icon: FileSearch,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    ring: "ring-indigo-200",
  },
  ASSESSMENT: {
    label: "Assessment",
    icon: ClipboardList,
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  AI_INTERVIEW: {
    label: "AI Interview",
    icon: Bot,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  MANUAL_REVIEW: {
    label: "Manual Review",
    icon: UserCheck,
    color: "text-purple-600",
    bg: "bg-purple-50",
    ring: "ring-purple-200",
  },
};

const STAGE_STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "In Progress",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  PENDING: {
    label: "Waiting",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  PASSED: {
    label: "Passed",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  FAILED: {
    label: "Failed",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  SKIPPED: {
    label: "Skipped",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const APP_STATUS_META: Record<string, { label: string; className: string }> = {
  Ready: {
    label: "New",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  Scheduled: {
    label: "Interview Scheduled",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  Completed: {
    label: "Interview Completed",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  Missed: {
    label: "Interview Missed",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
  Calling: {
    label: "In Call",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

const STAGE_FILTERS = [
  { value: "All", label: "All Candidates" },
  { value: "needs-review", label: "Needs Review" },
  { value: "RESUME_SCREENING", label: "Resume Screening" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "AI_INTERVIEW", label: "AI Interview" },
  { value: "MANUAL_REVIEW", label: "Manual Review" },
  { value: "not-started", label: "Not Started" },
  { value: "complete", label: "Complete" },
  { value: "failed", label: "Failed" },
];

const SORT_MODES = [
  { value: "priority", label: "Priority" },
  { value: "score", label: "ATS Score" },
  { value: "recent", label: "Last Activity" },
  { value: "applied", label: "Recently Applied" },
];

function timeAgo(date: Date | string): string {
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

export default function CandidatesPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="h-64 flex items-center justify-center text-slate-400 font-bold animate-pulse">
          Loading candidates...
        </div>
      }
    >
      <CandidatesPage />
    </Suspense>
  );
}

function CandidatesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobIdParam = searchParams.get("jobId");
  const jobId = jobIdParam ? parseInt(jobIdParam) : undefined;

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateRow | null>(
    null
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [sortMode, setSortMode] = useState("priority");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [filteredJob, setFilteredJob] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [topN, setTopN] = useState("");
  const [expandedCandidateId, setExpandedCandidateId] = useState<number | null>(
    null
  );
  const [view, setView] = useState<"pipeline" | "table">("pipeline");

  const loadCandidates = useCallback(() => {
    return getCandidates(jobId)
      .then((data) => {
        setCandidates(data);
        setError(false);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [jobId]);

  const fetchCandidates = useCallback(() => {
    setLoading(true);
    return loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    let cancelled = false;

    const request: Promise<{ id: number; title: string } | null> = jobId
      ? getJobById(jobId).then((job) =>
          job ? { id: job.id, title: job.title } : null
        )
      : Promise.resolve(null);

    request.then((job) => {
      if (!cancelled) setFilteredJob(job);
    });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const clearJobFilter = () => {
    router.push("/dashboard/candidates");
  };

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const roleQuery = roleFilter.trim().toLowerCase();
    const min = minScore ? parseInt(minScore, 10) : null;
    const max = maxScore ? parseInt(maxScore, 10) : null;

    const list = candidates.filter((candidate) => {
      const matchesSearch =
        query.length === 0 ||
        candidate.name.toLowerCase().includes(query) ||
        candidate.email.toLowerCase().includes(query) ||
        (candidate.jobTitle || "").toLowerCase().includes(query) ||
        (candidate.phone || "").toLowerCase().includes(query);

      const matchesRole =
        roleQuery.length === 0 ||
        (candidate.jobTitle || "").toLowerCase().includes(roleQuery) ||
        (candidate.linkedJobTitle || "").toLowerCase().includes(roleQuery);

      const matchesStatus =
        statusFilter === "All" || candidate.status === statusFilter;

      let matchesStage = true;
      if (stageFilter === "needs-review") matchesStage = candidate.needsReview;
      else if (stageFilter === "not-started")
        matchesStage =
          candidate.pipelineStatus === "not-started" ||
          candidate.pipelineStatus === "no-pipeline";
      else if (stageFilter === "complete")
        matchesStage = candidate.pipelineStatus === "complete";
      else if (stageFilter === "failed")
        matchesStage = candidate.pipelineStatus === "failed";
      else if (stageFilter !== "All")
        matchesStage = candidate.currentStageType === stageFilter;

      const parsedMatch = candidate.matchScore
        ? parseInt(candidate.matchScore, 10)
        : null;
      const matchesScore =
        (min === null || (parsedMatch !== null && parsedMatch >= min)) &&
        (max === null || (parsedMatch !== null && parsedMatch <= max));

      return (
        matchesSearch && matchesRole && matchesStatus && matchesStage && matchesScore
      );
    });

    const sorted = [...list].sort((a, b) => {
      if (sortMode === "priority") {
        if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
        const aActive = a.pipelineStatus === "in-progress" ? 1 : 0;
        const bActive = b.pipelineStatus === "in-progress" ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return (
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime()
        );
      }
      if (sortMode === "score") {
        const scoreA = a.matchScore ? parseInt(a.matchScore, 10) : -1;
        const scoreB = b.matchScore ? parseInt(b.matchScore, 10) : -1;
        return scoreB - scoreA;
      }
      if (sortMode === "recent") {
        return (
          new Date(b.lastActivityAt).getTime() -
          new Date(a.lastActivityAt).getTime()
        );
      }
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return topN && parseInt(topN, 10) > 0
      ? sorted.slice(0, parseInt(topN, 10))
      : sorted;
  }, [
    candidates,
    searchQuery,
    roleFilter,
    statusFilter,
    stageFilter,
    minScore,
    maxScore,
    sortMode,
    topN,
  ]);

  const pipelineColumns = useMemo(() => {
    const byColumn = new Map<string, CandidateRow[]>();
    for (const c of filteredCandidates) {
      let key: string;
      if (
        c.pipelineStatus === "not-started" ||
        c.pipelineStatus === "no-pipeline"
      ) {
        key = "not-started";
      } else if (c.pipelineStatus === "failed") {
        key = "failed";
      } else if (c.pipelineStatus === "complete") {
        key = "complete";
      } else if (c.currentStageType) {
        key = c.currentStageType;
      } else {
        key = "not-started";
      }
      const list = byColumn.get(key) ?? [];
      list.push(c);
      byColumn.set(key, list);
    }

    const columns: {
      key: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      color: string;
      bg: string;
      ring: string;
      candidates: CandidateRow[];
    }[] = [];

    for (const stage of STAGE_ORDER) {
      const meta = STAGE_META[stage];
      columns.push({
        key: stage,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        bg: meta.bg,
        ring: meta.ring,
        candidates: byColumn.get(stage) ?? [],
      });
    }

    const specials: {
      key: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      color: string;
      bg: string;
      ring: string;
    }[] = [
      {
        key: "complete",
        label: "Complete",
        icon: CheckCircle2,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        ring: "ring-emerald-200",
      },
      {
        key: "failed",
        label: "Failed",
        icon: XCircle,
        color: "text-rose-600",
        bg: "bg-rose-50",
        ring: "ring-rose-200",
      },
      {
        key: "not-started",
        label: "Not Started",
        icon: Inbox,
        color: "text-slate-500",
        bg: "bg-slate-100",
        ring: "ring-slate-200",
      },
    ];

    for (const s of specials) {
      const list = byColumn.get(s.key) ?? [];
      if (list.length > 0) columns.push({ ...s, candidates: list });
    }

    return columns;
  }, [filteredCandidates]);

  const toggleExpand = (id: number) => {
    setExpandedCandidateId(expandedCandidateId === id ? null : id);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-1.5">
            <Users className="w-4 h-4" /> Talent Pool
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Candidate Pipeline
          </h1>
          <p className="text-slate-600 text-base max-w-xl">
            {filteredJob
              ? `Showing candidates for "${filteredJob.title}"`
              : "Track and manage every recruit in your ecosystem."}
          </p>
        </motion.div>

        <AddCandidateModal onSuccess={fetchCandidates} />
      </section>

      {/* Job filter banner */}
      {filteredJob && (
        <Card className="p-4 bg-indigo-50 border-indigo-200 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-950">
              Filtered by job:{" "}
              <span className="font-bold text-indigo-700">{filteredJob.title}</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearJobFilter}
            className="h-8 px-3 text-xs font-bold text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 rounded-lg gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Clear filter
          </Button>
        </Card>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState onRetry={fetchCandidates} />
      ) : (
        <Card className="bg-white border-slate-200/80 overflow-hidden rounded-3xl shadow-xs">
          {/* Toolbar */}
          <div className="p-6 border-b border-slate-200/80 bg-slate-50/50 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setView("pipeline")}
                  className={`flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    view === "pipeline"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
                </button>
                <button
                  onClick={() => setView("table")}
                  className={`flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    view === "table"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" /> Table
                </button>
              </div>

              <div className="relative flex-1 min-w-[170px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidates..."
                  className="pl-9 h-10 w-full bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl focus:ring-indigo-500/20"
                />
              </div>
              <Input
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                placeholder="Assigned role..."
                className="h-10 flex-1 min-w-[140px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl focus:ring-indigo-500/20"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="Min ATS"
                className="h-10 w-24 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl focus:ring-indigo-500/20"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="Max ATS"
                className="h-10 w-24 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl focus:ring-indigo-500/20"
              />
              <Input
                type="number"
                min="1"
                value={topN}
                onChange={(e) => setTopN(e.target.value)}
                placeholder="Top N"
                className="h-10 w-24 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl focus:ring-indigo-500/20"
              />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-xl px-4"
                    >
                      <Filter className="w-3.5 h-3.5 mr-2" />
                      {STAGE_FILTERS.find((f) => f.value === stageFilter)?.label ??
                        "Stage"}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-48 rounded-xl border-slate-200 bg-white text-slate-800 shadow-md">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Pipeline Stage</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={stageFilter}
                      onValueChange={setStageFilter}
                    >
                      {STAGE_FILTERS.map((f) => (
                        <DropdownMenuRadioItem key={f.value} value={f.value}>
                          {f.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-xl px-4"
                    >
                      <Filter className="w-3.5 h-3.5 mr-2" />
                      {statusFilter === "All" ? "Status" : statusFilter}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-44 rounded-xl border-slate-200 bg-white text-slate-800 shadow-md">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={statusFilter}
                      onValueChange={(value) =>
                        setStatusFilter(value as (typeof STATUS_FILTERS)[number])
                      }
                    >
                      {STATUS_FILTERS.map((status) => (
                        <DropdownMenuRadioItem key={status} value={status}>
                          {status}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-xl px-4"
                    >
                      <Filter className="w-3.5 h-3.5 mr-2" />
                      Sort:{" "}
                      {SORT_MODES.find((s) => s.value === sortMode)?.label}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-44 rounded-xl border-slate-200 bg-white text-slate-800 shadow-md">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={sortMode}
                      onValueChange={setSortMode}
                    >
                      {SORT_MODES.map((s) => (
                        <DropdownMenuRadioItem key={s.value} value={s.value}>
                          {s.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                {filteredCandidates.length} candidate
                {filteredCandidates.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-base font-bold text-slate-900">No candidates found</p>
              <p className="text-xs text-slate-500 mt-1">
                {jobId
                  ? "No candidates have applied to this job yet."
                  : "Try a different name, email, role, stage, or score filter."}
              </p>
            </div>
          ) : view === "pipeline" ? (
            <PipelineBoard
              columns={pipelineColumns}
              expandedCandidateId={expandedCandidateId}
              onToggleExpand={toggleExpand}
              onPipelineChange={fetchCandidates}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="border-slate-200 hover:bg-transparent uppercase tracking-wider text-[10px]">
                    <TableHead className="text-slate-500 font-bold py-4 px-8">
                      Candidate
                    </TableHead>
                    <TableHead className="text-slate-500 font-bold">
                      Assigned Role
                    </TableHead>
                    <TableHead className="text-slate-500 font-bold">
                      Scores
                    </TableHead>
                    <TableHead className="text-slate-500 font-bold">
                      Current Stage
                    </TableHead>
                    <TableHead className="text-slate-500 font-bold">
                      Status
                    </TableHead>
                    <TableHead className="text-slate-500 font-bold text-right px-8">
                      Actions
                    </TableHead>
                    <TableHead className="text-slate-500 font-bold w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => (
                    <React.Fragment key={candidate.id}>
                      <TableRow
                        className={`border-slate-100 hover:bg-slate-50/80 transition-colors group cursor-default ${
                          candidate.needsReview ? "bg-purple-50/40" : ""
                        }`}
                      >
                        <TableCell className="py-4 px-8">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs ring-1 ring-indigo-200 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                              {candidate.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors truncate">
                                {candidate.name}
                                {candidate.needsReview && (
                                  <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                                    Review
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {candidate.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            onClick={() =>
                              candidate.targetJobId &&
                              (window.location.href = `/jobs/${candidate.targetJobId}`)
                            }
                            className={`flex items-center gap-2 font-medium transition-colors ${
                              candidate.targetJobId
                                ? "text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                : "text-slate-700"
                            }`}
                          >
                            <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span className="text-xs truncate max-w-[160px]">
                              {candidate.jobTitle || "General Role"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {candidate.matchScore ? (
                              <Badge
                                variant="outline"
                                className="bg-indigo-50 text-indigo-700 border-indigo-200 px-3 py-1 rounded-full text-[11px] font-bold"
                              >
                                {candidate.matchScore}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                          {(candidate.assessmentScore !== null ||
                            candidate.interviewScore !== null) && (
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                              A: {candidate.assessmentScore ?? "—"} · I:{" "}
                              {candidate.interviewScore ?? "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.pipelineStatus === "complete" ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            >
                              Complete
                            </Badge>
                          ) : candidate.pipelineStatus === "failed" ? (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 border-rose-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            >
                              Failed
                            </Badge>
                          ) : candidate.currentStageName ? (
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                                {candidate.currentStageName}
                              </div>
                              <StageStatusBadge
                                stageStatus={candidate.currentStageStatus}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Not started
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={candidate.status} />
                        </TableCell>
                        <TableCell className="text-right px-8">
                          <div className="flex items-center justify-end gap-2">
                            {candidate.resumeUrl && (
                              <a
                                href={candidate.resumeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 rounded-lg border-slate-200 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 text-[11px] font-bold"
                                >
                                  <FileText className="w-3.5 h-3.5 mr-1" /> Resume
                                </Button>
                              </a>
                            )}
                            {candidate.needsReview && (
                              <Button
                                size="sm"
                                onClick={() => toggleExpand(candidate.id)}
                                className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-xs"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Review
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCandidate(candidate);
                                setIsEditModalOpen(true);
                              }}
                              className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="pr-8">
                          <button
                            onClick={() => toggleExpand(candidate.id)}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              expandedCandidateId === candidate.id
                                ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200"
                                : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <ChevronRight
                              className={`w-4 h-4 transition-transform ${
                                expandedCandidateId === candidate.id
                                  ? "rotate-90"
                                  : ""
                              }`}
                            />
                          </button>
                        </TableCell>
                      </TableRow>

                      {expandedCandidateId === candidate.id && (
                        <TableRow className="border-slate-200 hover:bg-transparent">
                          <TableCell
                            colSpan={7}
                            className="px-8 py-4 bg-slate-50/50"
                          >
                            <CandidatePipelineCard
                              candidateId={candidate.id}
                              onPipelineChange={fetchCandidates}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      <EditCandidateModal
        candidate={editingCandidate}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={fetchCandidates}
      />
    </div>
  );
}

// ─── Pipeline board (stage-grouped) ───────────────────────────────

function PipelineBoard({
  columns,
  expandedCandidateId,
  onToggleExpand,
  onPipelineChange,
}: {
  columns: {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
    ring: string;
    candidates: CandidateRow[];
  }[];
  expandedCandidateId: number | null;
  onToggleExpand: (id: number) => void;
  onPipelineChange: () => void;
}) {
  return (
    <div className="overflow-x-auto pb-6 pt-6 px-4">
      <div className="flex gap-4 min-w-max">
        {columns.map((col) => (
          <div key={col.key} className="w-72 shrink-0">
            <div className="flex items-center gap-2 mb-3 px-2">
              <div
                className={`w-7 h-7 rounded-lg ${col.bg} ring-1 ${col.ring} flex items-center justify-center`}
              >
                <col.icon className={`w-3.5 h-3.5 ${col.color}`} />
              </div>
              <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                {col.label}
              </span>
              <Badge className="bg-slate-100 text-slate-600 border-none px-2 py-0.5 rounded-full text-[10px] font-bold">
                {col.candidates.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {col.candidates.length === 0 ? (
                <div className="h-24 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  No candidates
                </div>
              ) : (
                col.candidates.map((candidate) => (
                  <PipelineCandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    expanded={expandedCandidateId === candidate.id}
                    onToggleExpand={() => onToggleExpand(candidate.id)}
                    onPipelineChange={onPipelineChange}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineCandidateCard({
  candidate,
  expanded,
  onToggleExpand,
  onPipelineChange,
}: {
  candidate: CandidateRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onPipelineChange: () => void;
}) {
  const needsReview = candidate.needsReview;

  return (
    <div
      className={`rounded-2xl bg-white border p-4 space-y-3 transition-all ${
        needsReview
          ? "border-purple-300 ring-2 ring-purple-100 shadow-md shadow-purple-500/5"
          : "border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs ring-1 ring-indigo-100 shrink-0">
          {candidate.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">
            {candidate.name}
          </p>
          <p className="text-[10px] text-slate-500 truncate">{candidate.email}</p>
        </div>
        <button
          onClick={onToggleExpand}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
            expanded
              ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          }`}
          aria-label="Toggle candidate details"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {candidate.jobTitle && (
        <p className="text-[10px] text-slate-500 truncate flex items-center gap-1.5">
          <Briefcase className="w-3 h-3 text-indigo-600 shrink-0" />
          <span className="truncate">{candidate.jobTitle}</span>
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <ScoreChip
          label="ATS"
          value={candidate.matchScore ? `${candidate.matchScore}%` : null}
          color="indigo"
        />
        <ScoreChip
          label="Assess"
          value={
            candidate.assessmentScore !== null
              ? String(candidate.assessmentScore)
              : null
          }
          color="amber"
        />
        <ScoreChip
          label="Int"
          value={
            candidate.interviewScore !== null
              ? String(candidate.interviewScore)
              : null
          }
          color="emerald"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <StageStatusBadge stageStatus={candidate.currentStageStatus} />
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          {timeAgo(candidate.lastActivityAt)}
        </span>
      </div>

      {needsReview && (
        <Button
          size="sm"
          onClick={onToggleExpand}
          className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" /> Review Candidate
        </Button>
      )}

      {expanded && (
        <div className="pt-3 border-t border-slate-100">
          <CandidatePipelineCard
            candidateId={candidate.id}
            onPipelineChange={onPipelineChange}
          />
        </div>
      )}
    </div>
  );
}

function ScoreChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string | null;
  color: "indigo" | "amber" | "emerald";
}) {
  const colors = {
    indigo: "text-indigo-700 bg-indigo-50 border-indigo-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
  };

  if (value === null) {
    return (
      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
        {label} —
      </span>
    );
  }
  return (
    <span
      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors[color]}`}
    >
      {label} {value}
    </span>
  );
}

function StageStatusBadge({ stageStatus }: { stageStatus: string | null }) {
  const meta = stageStatus ? STAGE_STATUS_META[stageStatus] : undefined;
  if (!meta) {
    return (
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
        Not Started
      </span>
    );
  }
  return (
    <Badge
      variant="outline"
      className={`${meta.className} px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border`}
    >
      {meta.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = APP_STATUS_META[status] ?? APP_STATUS_META.Ready;
  return (
    <Badge
      variant="outline"
      className={`${meta.className} px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider`}
    >
      {meta.label}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="bg-white border-slate-200/80 overflow-hidden rounded-3xl shadow-xs">
      <div className="p-6 border-b border-slate-200/80 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-10 w-40 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 flex-1 min-w-[170px] rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden p-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <div className="h-6 w-40 rounded-lg bg-slate-100 animate-pulse" />
            {[0, 1].map((j) => (
              <div
                key={j}
                className="h-44 rounded-2xl bg-slate-50 animate-pulse"
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="p-10 bg-white border-slate-200/80 rounded-3xl shadow-xs flex flex-col items-center justify-center text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">Couldn&apos;t load candidates</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        Something went wrong while fetching your candidate pipeline. Please try
        again.
      </p>
      <Button
        onClick={onRetry}
        className="mt-6 h-11 px-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-xs"
      >
        <RefreshCw className="w-4 h-4 mr-2" /> Retry
      </Button>
    </Card>
  );
}