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
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    ring: "ring-indigo-500/20",
  },
  ASSESSMENT: {
    label: "Assessment",
    icon: ClipboardList,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    ring: "ring-amber-500/20",
  },
  AI_INTERVIEW: {
    label: "AI Interview",
    icon: Bot,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    ring: "ring-emerald-500/20",
  },
  MANUAL_REVIEW: {
    label: "Manual Review",
    icon: UserCheck,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    ring: "ring-purple-500/20",
  },
};

const STAGE_STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: "In Progress",
    className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  PENDING: {
    label: "Waiting",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
  PASSED: {
    label: "Passed",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  FAILED: {
    label: "Failed",
    className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  SKIPPED: {
    label: "Skipped",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
};

const APP_STATUS_META: Record<string, { label: string; className: string }> = {
  Ready: {
    label: "New",
    className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  },
  Scheduled: {
    label: "Interview Scheduled",
    className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  Completed: {
    label: "Interview Completed",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  Missed: {
    label: "Interview Missed",
    className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
  Calling: {
    label: "In Call",
    className: "bg-amber-500/10 text-amber-500 border-amber-500/20",
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
        <div className="h-64 flex items-center justify-center text-slate-500 font-bold animate-pulse">
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

  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<any>(null);
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

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getCandidates(jobId);
      setCandidates(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    if (jobId) {
      getJobById(jobId).then((job) => {
        if (job) setFilteredJob({ id: job.id, title: job.title });
      });
    } else {
      setFilteredJob(null);
    }
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
        // Requires review first, then active candidates, then recently active.
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
    const byColumn = new Map<string, any[]>();
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
      candidates: any[];
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
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        ring: "ring-emerald-500/20",
      },
      {
        key: "failed",
        label: "Failed",
        icon: XCircle,
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        ring: "ring-rose-500/20",
      },
      {
        key: "not-started",
        label: "Not Started",
        icon: Inbox,
        color: "text-slate-400",
        bg: "bg-white/[0.03]",
        ring: "ring-white/5",
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
    <div className="space-y-10 pb-20">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Users className="w-4 h-4" /> Talent Pool
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Candidate Pipeline
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            {filteredJob
              ? `Showing candidates for "${filteredJob.title}"`
              : "Track and manage every recruit in your ecosystem."}
          </p>
        </motion.div>

        <AddCandidateModal onSuccess={fetchCandidates} />
      </section>

      {/* Job filter banner */}
      {filteredJob && (
        <Card className="p-4 bg-indigo-600/10 border-indigo-500/20 rounded-2xl ring-1 ring-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-indigo-200">
              Filtered by job:{" "}
              <span className="font-bold text-white">{filteredJob.title}</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearJobFilter}
            className="h-8 px-3 text-xs font-bold text-indigo-300 hover:text-white hover:bg-indigo-500/20 rounded-lg gap-1.5"
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
        <Card className="bg-[#0a0a0f] border-slate-800/60 overflow-hidden rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
          {/* Toolbar */}
          <div className="p-6 lg:p-8 border-b border-slate-800/60 bg-white/[0.01] space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-white/[0.03] p-1 rounded-xl ring-1 ring-white/5">
                <button
                  onClick={() => setView("pipeline")}
                  className={`flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    view === "pipeline"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Pipeline
                </button>
                <button
                  onClick={() => setView("table")}
                  className={`flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-bold transition-all ${
                    view === "table"
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" /> Table
                </button>
              </div>

              <div className="relative flex-1 min-w-[170px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidates..."
                  className="pl-9 h-10 w-full bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
                />
              </div>
              <Input
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                placeholder="Assigned role..."
                className="h-10 flex-1 min-w-[140px] bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="Min ATS"
                className="h-10 w-24 bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
              />
              <Input
                type="number"
                min="0"
                max="100"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="Max ATS"
                className="h-10 w-24 bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
              />
              <Input
                type="number"
                min="1"
                value={topN}
                onChange={(e) => setTopN(e.target.value)}
                placeholder="Top N"
                className="h-10 w-24 bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
              />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 border-slate-800 bg-transparent text-slate-400 rounded-xl px-4"
                    >
                      <Filter className="w-3.5 h-3.5 mr-2" />
                      {STAGE_FILTERS.find((f) => f.value === stageFilter)?.label ??
                        "Stage"}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-48 rounded-xl border-slate-800 bg-[#0a0a0f] text-slate-200">
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
                      className="h-10 border-slate-800 bg-transparent text-slate-400 rounded-xl px-4"
                    >
                      <Filter className="w-3.5 h-3.5 mr-2" />
                      {statusFilter === "All" ? "Status" : statusFilter}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-44 rounded-xl border-slate-800 bg-[#0a0a0f] text-slate-200">
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
                      className="h-10 border-slate-800 bg-transparent text-slate-400 rounded-xl px-4"
                    >
                      <Filter className="w-3.5 h-3.5 mr-2" />
                      Sort:{" "}
                      {SORT_MODES.find((s) => s.value === sortMode)?.label}
                    </Button>
                  }
                />
                <DropdownMenuContent className="w-44 rounded-xl border-slate-800 bg-[#0a0a0f] text-slate-200">
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
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] ring-1 ring-white/5 flex items-center justify-center mx-auto mb-4">
                <Inbox className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-sm font-bold text-white">No candidates found</p>
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
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-slate-800/60 hover:bg-transparent uppercase tracking-wider text-[10px]">
                    <TableHead className="text-slate-500 font-bold py-6 px-8">
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
                        className={`border-slate-800/40 hover:bg-white/[0.02] transition-colors group cursor-default ${
                          candidate.needsReview ? "bg-purple-500/[0.03]" : ""
                        }`}
                      >
                        <TableCell className="py-6 px-8">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                              {candidate.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors truncate">
                                {candidate.name}
                                {candidate.needsReview && (
                                  <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 ring-1 ring-purple-500/20 px-2 py-0.5 rounded-full">
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
                                ? "text-indigo-400 hover:text-indigo-300 cursor-pointer"
                                : "text-slate-300"
                            }`}
                          >
                            <Briefcase className="w-3.5 h-3.5 shrink-0" />
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
                                className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-3 py-1 rounded-full text-[11px] font-bold"
                              >
                                {candidate.matchScore}%
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </div>
                          {(candidate.assessmentScore !== null ||
                            candidate.interviewScore !== null) && (
                            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-1">
                              A: {candidate.assessmentScore ?? "—"} · I:{" "}
                              {candidate.interviewScore ?? "—"}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {candidate.pipelineStatus === "complete" ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            >
                              Complete
                            </Badge>
                          ) : candidate.pipelineStatus === "failed" ? (
                            <Badge
                              variant="outline"
                              className="bg-rose-500/10 text-rose-400 border-rose-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            >
                              Failed
                            </Badge>
                          ) : candidate.currentStageName ? (
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate max-w-[150px]">
                                {candidate.currentStageName}
                              </div>
                              <StageStatusBadge
                                stageStatus={candidate.currentStageStatus}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">
                              Not started
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={candidate.status} />
                        </TableCell>
                        <TableCell className="text-right px-8">
                          <div className="flex items-center justify-end gap-2">
                            {candidate.needsReview && (
                              <Button
                                size="sm"
                                onClick={() => toggleExpand(candidate.id)}
                                className="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold"
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
                              className="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-600 hover:text-indigo-400 transition-colors"
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
                                ? "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20"
                                : "text-slate-600 hover:text-slate-400 hover:bg-white/5"
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
                        <TableRow className="border-slate-800/40 hover:bg-transparent">
                          <TableCell
                            colSpan={7}
                            className="px-8 py-4 bg-white/[0.01]"
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
    candidates: any[];
  }[];
  expandedCandidateId: number | null;
  onToggleExpand: (id: number) => void;
  onPipelineChange: () => void;
}) {
  return (
    <div className="overflow-x-auto pb-6 pt-6 px-2">
      <div className="flex gap-4 min-w-max px-2">
        {columns.map((col) => (
          <div key={col.key} className="w-72 shrink-0">
            <div className="flex items-center gap-2 mb-3 px-2">
              <div
                className={`w-7 h-7 rounded-lg ${col.bg} ring-1 ${col.ring} flex items-center justify-center`}
              >
                <col.icon className={`w-3.5 h-3.5 ${col.color}`} />
              </div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                {col.label}
              </span>
              <Badge className="bg-white/[0.04] text-slate-400 border-none px-2 py-0.5 rounded-full text-[10px] font-bold">
                {col.candidates.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {col.candidates.length === 0 ? (
                <div className="h-24 rounded-2xl border border-dashed border-slate-800/70 flex items-center justify-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">
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
  candidate: any;
  expanded: boolean;
  onToggleExpand: () => void;
  onPipelineChange: () => void;
}) {
  const needsReview = candidate.needsReview;

  return (
    <div
      className={`rounded-2xl bg-[#0a0a0f] border p-4 space-y-3 transition-all ${
        needsReview
          ? "border-purple-500/30 ring-1 ring-purple-500/20 shadow-[0_0_24px_rgba(168,85,247,0.08)]"
          : "border-slate-800/60 ring-1 ring-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/20 shrink-0">
          {candidate.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">
            {candidate.name}
          </p>
          <p className="text-[10px] text-slate-500 truncate">{candidate.email}</p>
        </div>
        <button
          onClick={onToggleExpand}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
            expanded
              ? "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20"
              : "text-slate-600 hover:text-slate-400 hover:bg-white/5"
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
          <Briefcase className="w-3 h-3 text-indigo-400/70 shrink-0" />
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
        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
          {timeAgo(candidate.lastActivityAt)}
        </span>
      </div>

      {needsReview && (
        <Button
          size="sm"
          onClick={onToggleExpand}
          className="w-full h-9 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" /> Review Candidate
        </Button>
      )}

      {expanded && (
        <div className="pt-3 border-t border-slate-800/40">
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
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  };

  if (value === null) {
    return (
      <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
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
      <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
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
    <Card className="bg-[#0a0a0f] border-slate-800/60 overflow-hidden rounded-[2.5rem] ring-1 ring-white/5">
      <div className="p-6 lg:p-8 border-b border-slate-800/60 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-10 w-40 rounded-xl bg-white/[0.03] animate-pulse" />
          <div className="h-10 flex-1 min-w-[170px] rounded-xl bg-white/[0.03] animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-white/[0.03] animate-pulse" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden p-6 lg:p-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <div className="h-6 w-40 rounded-lg bg-white/[0.03] animate-pulse" />
            {[0, 1].map((j) => (
              <div
                key={j}
                className="h-44 rounded-2xl bg-white/[0.02] animate-pulse"
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
    <Card className="p-10 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 flex flex-col items-center justify-center text-center py-20">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-rose-400" />
      </div>
      <h3 className="text-lg font-bold text-white">Couldn&apos;t load candidates</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">
        Something went wrong while fetching your candidate pipeline. Please try
        again.
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