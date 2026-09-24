"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Briefcase,
  LayoutGrid,
  Table as TableIcon,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Search,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getJobPipelineOverview } from "@/app/actions/candidate-pipeline";
import CandidatePipelineCard from "@/components/CandidatePipelineCard";
import DeleteJobAlertModal from "@/components/DeleteJobAlertModal";
import ParsedResumeModal from "@/components/ParsedResumeModal";

type OverviewData = Awaited<ReturnType<typeof getJobPipelineOverview>>;
type PipelineCandidate = NonNullable<OverviewData>["rounds"][number]["passedCandidates"][number];

export default function JobCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const jobId = parseInt(resolvedParams.id, 10);

  const router = useRouter();
  const [overview, setOverview] = useState<OverviewData>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"table" | "pipeline">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFailed, setShowFailed] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [viewingResumeCandidate, setViewingResumeCandidate] = useState<{
    name: string;
    resumeFileName?: string | null;
    resumeText?: string | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (isNaN(jobId)) return;
    setLoading(true);
    try {
      const data = await getJobPipelineOverview(jobId);
      setOverview(data);
    } catch (err) {
      console.error("Failed to load job candidates overview:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">Loading candidate pipeline...</p>
      </div>
    );
  }

  if (!overview || !overview.job) {
    return (
      <div className="space-y-6 pb-20">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Back to Jobs</span>
        </Link>
        <Card className="p-12 text-center bg-white border-slate-200 rounded-3xl shadow-xs">
          <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Job Not Found</h2>
          <p className="text-slate-500 text-sm mt-1">
            The job position you are trying to view does not exist or you don&apos;t have permission.
          </p>
        </Card>
      </div>
    );
  }

  const { job, rounds, allCandidates } = overview;

  // Filter candidates by search query
  const filteredCandidates = allCandidates.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.jobTitle && c.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <section className="space-y-4">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Back to Jobs</span>
        </Link>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                Job #{job.id.toString().padStart(4, "0")}
              </Badge>
              {job.department && (
                <Badge variant="outline" className="text-slate-600 border-slate-200 text-[10px] font-bold uppercase">
                  {job.department}
                </Badge>
              )}
              <Badge
                className={`border px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                  job.status === "PUBLISHED" || job.status === "Open"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {job.status}
              </Badge>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{job.title}</h1>
            <p className="text-sm text-slate-500 font-medium">
              {job.location} • {job.workMode || "Remote"} • {job.employmentType || "Full-time"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-center min-w-[110px]">
              <span className="block text-2xl font-extrabold text-slate-900">{allCandidates.length}</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Candidates</span>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 px-5 py-3 rounded-2xl text-center min-w-[110px]">
              <span className="block text-2xl font-extrabold text-indigo-600">{rounds.length}</span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Rounds</span>
            </div>

            {/* Owner Actions: Edit & Delete */}
            <div className="flex items-center gap-2 ml-0 sm:ml-2">
              <Link href={`/dashboard/jobs/create?jobId=${job.id}`}>
                <Button
                  variant="outline"
                  className="h-12 px-4 rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider"
                >
                  <Pencil className="w-4 h-4 mr-1.5 text-indigo-600" /> Edit Job
                </Button>
              </Link>
              <DeleteJobAlertModal
                jobId={jobId}
                jobTitle={job.title}
                onSuccess={() => router.push("/dashboard/jobs")}
                trigger={
                  <Button
                    variant="outline"
                    className="h-12 px-4 rounded-2xl border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100 text-xs font-bold uppercase tracking-wider"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5 text-rose-600" /> Delete
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Controls: View Mode Tabs + Search + Filter Options */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Tab Selector */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setActiveTab("table")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "table"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TableIcon className="w-4 h-4 text-indigo-600" /> Table View
          </button>
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "pipeline"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-indigo-600" /> Pipeline View
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name or email..."
              className="pl-10 h-11 bg-white border-slate-200 text-slate-900 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
            />
          </div>

          {activeTab === "pipeline" && (
            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors shrink-0">
              <input
                type="checkbox"
                checked={showFailed}
                onChange={(e) => setShowFailed(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                Show Failed Candidates
              </span>
            </label>
          )}
        </div>
      </div>

      {/* ─── TAB 1: TABLE VIEW ─── */}
      {activeTab === "table" && (
        <Card className="bg-white border-slate-200/80 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                  <th className="py-4 px-6">Name</th>
                  <th className="py-4 px-6">Role</th>
                  <th className="py-4 px-6">ATS Score</th>
                  <th className="py-4 px-6">Current Stage</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Pipeline</th>
                  <th className="py-4 px-6 text-right">Resume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCandidates.map((candidate) => (
                  <tr key={candidate.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{candidate.name}</div>
                      <div className="text-xs text-slate-400 font-medium">{candidate.email}</div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      {candidate.jobTitle || job.title}
                    </td>

                    {/* ATS Score */}
                    <td className="py-4 px-6">
                      {candidate.atsScore !== null ? (
                        <Badge
                          className={`border px-3 py-1 rounded-full text-xs font-bold ${
                            candidate.atsScore >= 75
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : candidate.atsScore >= 50
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          <Sparkles className="w-3 h-3 mr-1 text-current" />
                          {candidate.atsScore}% Match
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not Scored</span>
                      )}
                    </td>

                    {/* Current Stage */}
                    <td className="py-4 px-6">
                      <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 font-bold text-xs px-3 py-1 rounded-xl">
                        {candidate.currentStageName}
                      </Badge>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <Badge
                        className={`border px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          candidate.currentStageStatus === "PASSED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : candidate.currentStageStatus === "ACTIVE"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : candidate.currentStageStatus === "FAILED"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {candidate.currentStageStatus}
                      </Badge>
                    </td>

                    {/* Load Pipeline Button */}
                    <td className="py-4 px-6 text-center">
                      <Button
                        size="sm"
                        onClick={() => setSelectedCandidateId(candidate.id)}
                        className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                      >
                        Load Pipeline
                      </Button>
                    </td>

                    {/* View Resume Button */}
                    <td className="py-4 px-6 text-right">
                      {(candidate.resumeText || candidate.resumeUrl) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingResumeCandidate({
                            name: candidate.name,
                            resumeFileName: candidate.resumeFileName,
                            resumeText: candidate.resumeText,
                          })}
                          className="h-9 px-3 rounded-xl border-slate-200 text-indigo-600 hover:bg-indigo-50 text-xs font-bold"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Resume
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Resume</span>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredCandidates.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      No candidates found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ─── TAB 2: PIPELINE VIEW ─── */}
      {activeTab === "pipeline" && (
        <div className="flex flex-row gap-6 items-start overflow-x-auto pb-8 pt-2 px-1 w-full font-sans">
          {rounds.map((round) => {
            const { stats, passedCandidates, failedCandidates } = round;

            return (
              <Card
                key={round.id}
                className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-xs flex flex-col w-[300px] sm:w-[335px] shrink-0"
              >
                {/* Round Header & Stats */}
                <div className="border-b border-slate-100 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                      Round {round.order}
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold uppercase bg-slate-50 border-slate-200 text-slate-600">
                      {round.type}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">{round.name}</h3>

                  {/* Analytics Banner */}
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Selection Rate</span>
                      <span className="text-lg font-extrabold text-indigo-900">{stats.passPercentage}%</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Passed / Evaluated</span>
                      <span className="text-xs font-bold text-slate-700">
                        {stats.passedCount} / {stats.evaluatedCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Passed / Active Candidates */}
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Selected / Active ({passedCandidates.length})
                    </span>
                  </div>

                  {passedCandidates.map((cand: PipelineCandidate) => (
                    <div
                      key={cand.id}
                      onClick={() => {
                        if (cand?.id) setSelectedCandidateId(cand.id);
                      }}
                      className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/40 hover:border-indigo-300 transition-all cursor-pointer space-y-2 group shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
                          {cand.name}
                        </div>
                        {cand.atsScore !== null && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px] font-bold px-2 py-0.5">
                            {cand.atsScore}%
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 font-medium truncate">{cand.email}</div>

                      {cand.roundScore !== null && (
                        <div className="text-[11px] font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-100 inline-block">
                          Round Score: {cand.roundScore}
                        </div>
                      )}
                    </div>
                  ))}

                  {passedCandidates.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      No candidates passed yet
                    </div>
                  )}
                </div>

                {/* Failed Candidates (visible only if showFailed toggle is ON) */}
                {showFailed && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected ({failedCandidates.length})
                      </span>
                    </div>

                    {failedCandidates.map((cand: PipelineCandidate) => (
                      <div
                        key={cand.id}
                        onClick={() => {
                          if (cand?.id) setSelectedCandidateId(cand.id);
                        }}
                        className="p-3.5 rounded-2xl border border-rose-100 bg-rose-50/30 hover:bg-rose-50/70 transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-slate-900 text-sm">
                            {cand.name}
                          </div>
                          <Badge className="bg-rose-100 text-rose-800 border-none text-[10px] font-bold px-2 py-0.5">
                            Failed
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 truncate">{cand.email}</div>
                        {cand.roundFeedback && (
                          <div className="text-[11px] text-rose-700 italic line-clamp-2">
                            &quot;{cand.roundFeedback}&quot;
                          </div>
                        )}
                      </div>
                    ))}

                    {failedCandidates.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400 italic">
                        No rejected candidates
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Candidate Pipeline Modal */}
      <Dialog
        open={selectedCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCandidateId(null);
        }}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[750px] rounded-[2rem] p-0 overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 sm:p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">
                Candidate Pipeline Progression
              </DialogTitle>
            </DialogHeader>

            {selectedCandidateId !== null && (
              <CandidatePipelineCard
                candidateId={selectedCandidateId}
                onPipelineChange={loadData}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ParsedResumeModal
        isOpen={!!viewingResumeCandidate}
        onClose={() => setViewingResumeCandidate(null)}
        candidateName={viewingResumeCandidate?.name || ""}
        resumeFileName={viewingResumeCandidate?.resumeFileName}
        resumeText={viewingResumeCandidate?.resumeText ?? null}
      />
    </div>
  );
}
