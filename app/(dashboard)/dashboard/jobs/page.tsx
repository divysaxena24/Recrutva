"use client";

import { motion } from "framer-motion";
import { Briefcase, MapPin, Calendar, Search, Trash2, Globe, Pencil, Sparkles, Eye, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getJobs } from "@/app/actions/job";
import AddJobModal from "@/components/AddJobModal";
import JobDetailsModal from "@/components/JobDetailsModal";
import { useUser } from "@clerk/nextjs";

import DeleteJobAlertModal from "@/components/DeleteJobAlertModal";

/** A job row as returned by the getJobs server action. */
type Job = Awaited<ReturnType<typeof getJobs>>[number];

// Statuses that appear in the candidate-facing listing.
// "Open" is the legacy value used by manually-created jobs.
const isPublicStatus = (status: string) => status === "PUBLISHED" || status === "Open";
const isDraft = (status: string) => status === "DRAFT";

export default function JobsPage() {
  const { user } = useUser();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Loader shared by the mount effect and the refresh handlers. State is only
  // written from promise callbacks: React forbids setState calls made
  // synchronously from an effect, directly or through a called function.
  const loadJobs = useCallback(() => {
    return getJobs()
      .then((data) => {
        setJobs(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // User-triggered refresh (create/delete) — re-shows the loading state.
  const fetchJobs = useCallback(() => {
    setLoading(true);
    return loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const filteredJobs = jobs.filter((job) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return true;

    return (
      job.title.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query)
    );
  });



  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
            <Briefcase className="w-4 h-4" /> Management
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Job Management
          </h1>
          <p className="text-slate-600 text-lg max-w-xl">
            Create and manage public job listings. All jobs are visible to potential candidates.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-3"
        >
          <Link href="/dashboard/jobs/create">
            <Button
              variant="outline"
              className="rounded-full px-6 h-12 font-bold border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shadow-xs"
            >
              <Sparkles className="w-5 h-5 mr-2 text-indigo-600" />
              Create with AI
            </Button>
          </Link>
          <AddJobModal onSuccess={fetchJobs} />
        </motion.div>
      </section>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search jobs by title or location..."
          className="pl-10 h-12 bg-white border-slate-200 text-slate-900 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500/20 shadow-xs"
        />
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.map((job, i) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="h-full bg-white border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between group hover:border-indigo-300 transition-all shadow-xs hover:shadow-md">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                    <Briefcase className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {job.userId === user?.id && (
                      <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
                        <Link href={`/dashboard/jobs/create?jobId=${job.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Edit Job"
                            className="w-7 h-7 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-500 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <DeleteJobAlertModal
                          jobId={job.id}
                          jobTitle={job.title}
                          onSuccess={fetchJobs}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Job"
                              className="w-7 h-7 rounded-lg hover:bg-white hover:text-rose-600 text-slate-500 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          }
                        />
                      </div>
                    )}
                    <Badge
                      className={`border px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isDraft(job.status)
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isPublicStatus(job.status)
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {job.status}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {job.title} <span className="text-slate-400 text-sm font-semibold ml-1">(#{job.id.toString().padStart(4, '0')})</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.location}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(job.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <p className="text-slate-600 text-sm line-clamp-3 leading-relaxed">
                  {job.description}
                </p>

                <div
                  className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider ${
                    isDraft(job.status) ? "text-amber-700" : "text-indigo-600"
                  }`}
                >
                   <Globe className="w-3 h-3" />
                   {isDraft(job.status) ? "Draft — not visible to candidates" : "Publicly Listed"}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <JobDetailsModal
                  job={job}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-10 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                      View Application
                    </Button>
                  }
                />
                <Link href={`/dashboard/jobs/${job.id}/candidates`} className="flex-1">
                  <Button
                    size="sm"
                    className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-indigo-500/20"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    View Candidates
                  </Button>
                </Link>
              </div>
            </Card>
          </motion.div>
        ))}

        {filteredJobs.length === 0 && !loading && (
          <Card className="col-span-full h-64 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-slate-500 rounded-3xl">
            <Briefcase className="w-12 h-12 mb-4 text-slate-300" />
            <p className="font-semibold text-slate-600">
              {jobs.length === 0 ? "No job roles created yet. Start by posting a new opportunity." : "No jobs match your search."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

