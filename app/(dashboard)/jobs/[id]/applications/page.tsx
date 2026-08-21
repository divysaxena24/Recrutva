"use client";

import { motion } from "framer-motion";
import {
  Users,
  ArrowRight,
  Briefcase,
  ExternalLink,
  FileText,
  Calendar,
  Mail,
  Phone,
  AlertCircle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useEffect, use } from "react";
import { getApplicationsByJobId } from "@/app/actions/application";
import Link from "next/link";

type Application = {
  id: number;
  name: string;
  email: string;
  phone: string;
  resumeUrl: string | null;
  resumeFileName: string | null;
  matchScore: string | null;
  status: string;
  analysis: unknown;
  createdAt: Date;
};

const STATUS_STYLES: Record<string, string> = {
  Ready: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  Calling: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  Scheduled: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

export default function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobId = parseInt(id);

  const [jobTitle, setJobTitle] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      setError("");

      const result = await getApplicationsByJobId(jobId);

      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      setJobTitle(result.jobTitle ?? "");
      setApplications(result.applications ?? []);
      setLoading(false);
    };

    if (!isNaN(jobId)) {
      fetchApplications();
    }
  }, [jobId]);

  const filteredApplications = applications.filter((app) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      app.name.toLowerCase().includes(q) ||
      app.email.toLowerCase().includes(q) ||
      (app.phone || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="space-y-10 pb-20">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
              <Users className="w-4 h-4" /> Loading
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              Loading applications...
            </h1>
          </motion.div>
        </section>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-10 pb-20">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-widest mb-2">
              <AlertCircle className="w-4 h-4" /> Error
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              Unable to load applications
            </h1>
            <p className="text-slate-400 text-lg max-w-xl">{error}</p>
          </motion.div>
        </section>
        <Link href="/dashboard/jobs">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl border-slate-800 text-slate-400 hover:bg-white/5 text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4 rotate-180 mr-2" /> Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

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
            <Users className="w-4 h-4" /> Applications
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            {jobTitle} Applications
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            {applications.length === 0
              ? "No applications yet for this position."
              : `${applications.length} candidate${applications.length === 1 ? "" : "s"} applied`}
          </p>
        </motion.div>

        <Link href="/dashboard/jobs">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl border-slate-800 text-slate-400 hover:bg-white/5 text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4 rotate-180 mr-2" /> Back to Jobs
          </Button>
        </Link>
      </section>

      {/* Job info bar */}
      <Card className="p-4 bg-indigo-600/10 border-indigo-500/20 rounded-2xl ring-1 ring-indigo-500/20 flex items-center gap-3">
        <Briefcase className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-medium text-indigo-200">
          Viewing applications for{" "}
          <span className="font-bold text-white">{jobTitle}</span>
        </span>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or phone..."
          className="pl-10 h-12 bg-[#0a0a0f] border-slate-800/60 rounded-2xl text-sm focus:ring-indigo-500/50"
        />
      </div>

      {/* Applications Table */}
      <Card className="bg-[#0a0a0f] border-slate-800/60 overflow-hidden rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
        <div className="p-8 border-b border-slate-800/60 flex items-center justify-between bg-white/[0.01]">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            {filteredApplications.length} application
            {filteredApplications.length === 1 ? "" : "s"}
          </p>
        </div>

        <Table>
          <TableHeader className="bg-white/[0.02]">
            <TableRow className="border-slate-800/60 hover:bg-transparent uppercase tracking-wider text-[10px]">
              <TableHead className="text-slate-500 font-bold py-6 px-8">
                Candidate
              </TableHead>
              <TableHead className="text-slate-500 font-bold">
                Contact
              </TableHead>
              <TableHead className="text-slate-500 font-bold">
                ATS Score
              </TableHead>
              <TableHead className="text-slate-500 font-bold">
                Status
              </TableHead>
              <TableHead className="text-slate-500 font-bold">
                Resume
              </TableHead>
              <TableHead className="text-slate-500 font-bold text-right px-8">
                Applied
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredApplications.map((app) => (
              <TableRow
                key={app.id}
                className="border-slate-800/40 hover:bg-white/[0.02] transition-colors group"
              >
                {/* Candidate Name */}
                <TableCell className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                      {app.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">
                        {app.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        #{app.id.toString().padStart(4, "0")}
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Contact */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Mail className="w-3 h-3 text-slate-600" />
                      <span className="truncate max-w-[180px]">
                        {app.email}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Phone className="w-3 h-3 text-slate-600" />
                      <span>{app.phone}</span>
                    </div>
                  </div>
                </TableCell>

                {/* ATS Score */}
                <TableCell>
                  {app.matchScore ? (
                    <Badge
                      variant="outline"
                      className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-3 py-1 rounded-full text-[11px] font-bold"
                    >
                      {app.matchScore}%
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`${
                      STATUS_STYLES[app.status] || STATUS_STYLES.Ready
                    } px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider`}
                  >
                    {app.status}
                  </Badge>
                </TableCell>

                {/* Resume */}
                <TableCell>
                  {app.resumeUrl ? (
                    <a
                      href={app.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Resume
                      <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-600">
                      No resume uploaded
                    </span>
                  )}
                </TableCell>

                {/* Applied Date */}
                <TableCell className="text-right px-8">
                  <div className="flex items-center gap-2 justify-end text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date(app.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {filteredApplications.length === 0 && (
              <TableRow className="border-slate-800/40 hover:bg-transparent">
                <TableCell colSpan={6} className="px-8 py-14 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-white">
                      No applications yet
                    </p>
                    <p className="text-xs text-slate-500">
                      {applications.length === 0
                        ? "No candidates have applied for this job yet."
                        : "No applications match your search."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
