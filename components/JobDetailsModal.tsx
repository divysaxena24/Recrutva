"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  MapPin,
  Calendar,
  Building,
  DollarSign,
  Clock,
  ExternalLink,
  Eye,
  CheckCircle2,
  Sparkles,
  FileText,
  Pencil,
} from "lucide-react";
import Link from "next/link";

interface JobDetailsModalProps {
  job: {
    id: number;
    title: string;
    description: string;
    requirements?: string | null;
    location: string;
    status: string;
    department?: string | null;
    employmentType?: string | null;
    experience?: string | null;
    workMode?: string | null;
    salaryRange?: string | null;
    summary?: string | null;
    responsibilities?: string[] | null;
    requiredSkills?: string[] | null;
    preferredSkills?: string[] | null;
    qualifications?: string[] | null;
    benefits?: string[] | null;
    createdAt: Date | string;
  };
  trigger?: React.ReactNode;
}

export default function JobDetailsModal({ job, trigger }: JobDetailsModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-indigo-600" /> View Application
            </Button>
          )
        }
      />
      <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[700px] rounded-[2rem] p-0 overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between gap-4 mb-3">
            <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              Job #{job.id.toString().padStart(4, "0")}
            </Badge>
            <Badge
              className={`border px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                job.status === "PUBLISHED" || job.status === "Open"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-400/30"
              }`}
            >
              {job.status}
            </Badge>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            {job.title}
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
            {job.department && (
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-indigo-400" /> {job.department}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" /> {job.location} ({job.workMode || "Remote"})
            </span>
            {job.employmentType && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> {job.employmentType}
              </span>
            )}
            {job.salaryRange && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> {job.salaryRange}
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-700">
          {/* Summary / Overview */}
          {job.summary && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Overview
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{job.summary}</p>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" /> Job Description
            </h3>
            <p className="text-sm leading-relaxed text-slate-600 whitespace-pre-line bg-white border border-slate-100 p-4 rounded-2xl">
              {job.description}
            </p>
          </div>

          {/* Required Skills */}
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.requiredSkills.map((skill, i) => (
                  <Badge
                    key={i}
                    className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-semibold"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Skills */}
          {job.preferredSkills && job.preferredSkills.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Preferred Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.preferredSkills.map((skill, i) => (
                  <Badge
                    key={i}
                    className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 rounded-full text-xs font-semibold"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Responsibilities */}
          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Key Responsibilities</h3>
              <ul className="space-y-2">
                {job.responsibilities.map((resp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>{resp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Qualifications & Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {job.qualifications && job.qualifications.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">Qualifications</h3>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {job.qualifications.map((q, i) => (
                    <li key={i}>• {q}</li>
                  ))}
                </ul>
              </div>
            )}

            {job.benefits && job.benefits.length > 0 && (
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2">Benefits & Perks</h3>
                <ul className="space-y-1.5 text-xs text-emerald-800">
                  {job.benefits.map((b, i) => (
                    <li key={i}>✓ {b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-xl h-11 px-5 font-bold text-slate-600 hover:bg-slate-200/60"
            >
              Close
            </Button>
            <Link href={`/dashboard/jobs/create?jobId=${job.id}`}>
              <Button
                variant="outline"
                className="rounded-xl h-11 px-5 font-bold border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                <Pencil className="w-4 h-4 mr-2 text-indigo-600" /> Edit Job
              </Button>
            </Link>
          </div>

          <Link href={`/jobs/${job.id}`} target="_blank">
            <Button className="rounded-xl h-11 px-6 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20">
              <ExternalLink className="w-4 h-4 mr-2" /> View Candidate Application Page
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
