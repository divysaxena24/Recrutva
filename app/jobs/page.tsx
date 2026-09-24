"use client";

import { motion } from "framer-motion";
import { Briefcase, MapPin, Calendar, Search, ArrowRight, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { getAllJobs } from "@/app/actions/job";
import { getAppliedJobIds } from "@/app/actions/applied-jobs";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AppliedFilter = "all" | "applied" | "not-applied";
type SortBy = "newest" | "oldest";
type DateRange = "all" | "week" | "month" | "quarter";

export default function PublicJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Array<{ id: number; title: string; location: string | null; description: string; createdAt: Date }>>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [dateRange, setDateRange] = useState<DateRange>("all");

  useEffect(() => {
    Promise.all([getAllJobs(), getAppliedJobIds()]).then(([jobsData, appliedIds]) => {
      setJobs(jobsData);
      setAppliedJobIds(appliedIds);
      setLoading(false);
    });
  }, []);

  // Derive unique locations for the filter dropdown
  const uniqueLocations = [...new Set(jobs.map((j) => j.location).filter((loc): loc is string => Boolean(loc)))].sort();

  // Lazy initializer: Date.now() runs once at mount, satisfies React purity lint
  const [nowMs] = useState(() => Date.now());

  const filteredJobs = jobs.filter((job) => {
    // 1. Text search
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const matchesSearch =
        job.title.toLowerCase().includes(query) ||
        (job.location ?? "").toLowerCase().includes(query) ||
        job.description.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // 2. Applied / Not-Applied filter
    const isApplied = appliedJobIds.includes(job.id);
    if (appliedFilter === "applied" && !isApplied) return false;
    if (appliedFilter === "not-applied" && isApplied) return false;

    // 3. Location filter
    if (locationFilter !== "all" && job.location !== locationFilter) return false;

    // 4. Date range filter
    if (dateRange !== "all") {
      const posted = new Date(job.createdAt).getTime();
      const msPerDay = 86_400_000;
      const cutoff =
        dateRange === "week"   ? nowMs - 7 * msPerDay :
        dateRange === "month"  ? nowMs - 30 * msPerDay :
        dateRange === "quarter"? nowMs - 90 * msPerDay : 0;
      if (posted < cutoff) return false;
    }

    return true;
  });

  // 5. Sort
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortBy === "newest" ? dateB - dateA : dateA - dateB;
  });

  const activeFilterCount =
    (appliedFilter !== "all" ? 1 : 0) +
    (locationFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Navbar */}
      <nav className="h-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl ring-1 ring-indigo-100">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Recrutva <span className="text-indigo-600">Careers</span></span>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold">Recruiter Login</Button>
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-8">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-10">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by role or location..." 
            className="pl-12 h-14 bg-white border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-slate-400 focus:ring-indigo-500/20 shadow-xs"
          />
        </div>

        {/* ── Filters ─────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setAppliedFilter("all"); setLocationFilter("all"); setDateRange("all"); setSortBy("newest"); }}
                className="ml-2 text-indigo-600 hover:text-indigo-800 underline underline-offset-2 cursor-pointer font-bold"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* ── Applied filter (pills) ───────────────────── */}
            <div className="flex rounded-xl bg-white border border-slate-200 p-1 shadow-xs">
              {(["all", "applied", "not-applied"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setAppliedFilter(opt)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    appliedFilter === opt
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {opt === "all" ? "All Jobs" : opt === "applied" ? "Applied" : "Not Applied"}
                </button>
              ))}
            </div>

            {/* ── Location filter ──────────────────────────── */}
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer hover:border-slate-300 transition-colors appearance-none outline-none shadow-xs"
            >
              <option value="all">All Locations</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            {/* ── Date range filter ────────────────────────── */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer hover:border-slate-300 transition-colors appearance-none outline-none shadow-xs"
            >
              <option value="all">Any Time</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="quarter">Past Quarter</option>
            </select>

            {/* ── Sort ─────────────────────────────────────── */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="h-10 px-4 rounded-xl bg-white border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer hover:border-slate-300 transition-colors appearance-none outline-none shadow-xs"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full bg-white border-slate-200/80 rounded-3xl p-6 lg:p-8 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center ring-1 ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all text-indigo-600">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{job.title}</h3>
                    <div className="flex flex-col gap-1.5 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                       <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-500" /> {job.location}</div>
                       <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-500" /> {new Date(job.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                    {job.description}
                  </p>
                </div>

                {appliedJobIds.includes(job.id) && (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold uppercase tracking-widest mt-4">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Applied
                  </div>
                )}

                <div className="mt-8 pt-5 border-t border-slate-100">
                  <Link href={`/jobs/${job.id}`}>
                    <Button className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold group shadow-xs">
                      Apply Now <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {sortedJobs.length === 0 && !loading && (
          <div className="text-center py-20 bg-white border border-slate-200/80 rounded-3xl">
             <Briefcase className="w-16 h-16 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-600 text-lg font-medium">No jobs match your search right now.</p>
          </div>
        )}
      </main>
    </div>
  );
}
