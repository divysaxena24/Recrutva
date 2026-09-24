"use client";

import { motion } from "framer-motion";
import {
  Briefcase,
  MapPin,
  Search,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
  X,
  Building2,
  Clock,
  DollarSign,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo } from "react";
import { getAllJobs } from "@/app/actions/job";
import { getAppliedJobIds } from "@/app/actions/applied-jobs";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AppliedFilter = "all" | "applied" | "not-applied";
type SortBy = "newest" | "oldest" | "title-asc";
type DateRange = "all" | "day" | "week" | "month";

interface JobItem {
  id: number;
  title: string;
  location: string | null;
  description: string;
  createdAt: Date;
  department?: string | null;
  employmentType?: string | null;
  experience?: string | null;
  workMode?: string | null;
  salaryRange?: string | null;
  requiredSkills?: string[] | null;
}

export default function PublicJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedFilter, setAppliedFilter] = useState<AppliedFilter>("all");
  const [workModeFilter, setWorkModeFilter] = useState("all");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");

  useEffect(() => {
    Promise.all([getAllJobs(), getAppliedJobIds()]).then(([jobsData, appliedIds]) => {
      setJobs(jobsData as JobItem[]);
      setAppliedJobIds(appliedIds);
      setLoading(false);
    });
  }, []);

  // Dynamically derived filter options from real job listings
  const uniqueLocations = useMemo(() => {
    return [...new Set(jobs.map((j) => j.location).filter((loc): loc is string => Boolean(loc)))].sort();
  }, [jobs]);

  const uniqueDepartments = useMemo(() => {
    return [...new Set(jobs.map((j) => j.department).filter((dept): dept is string => Boolean(dept)))].sort();
  }, [jobs]);

  const uniqueEmploymentTypes = useMemo(() => {
    const defaultTypes = ["Full-time", "Part-time", "Contract", "Internship"];
    const fromJobs = jobs.map((j) => j.employmentType).filter((t): t is string => Boolean(t));
    return [...new Set([...defaultTypes, ...fromJobs])].sort();
  }, [jobs]);

  const uniqueWorkModes = useMemo(() => {
    const defaultModes = ["Remote", "Hybrid", "On-site"];
    const fromJobs = jobs.map((j) => j.workMode).filter((m): m is string => Boolean(m));
    return [...new Set([...defaultModes, ...fromJobs])].sort();
  }, [jobs]);

  // Lazy initializer: Date.now() runs once at mount
  const [nowMs] = useState(() => Date.now());

  // Comprehensive multi-filter evaluation
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. Keyword search (Title, Skills, Description, Department, Location)
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const skillsText = (job.requiredSkills ?? []).join(" ").toLowerCase();
        const matchesSearch =
          job.title.toLowerCase().includes(query) ||
          (job.location ?? "").toLowerCase().includes(query) ||
          (job.department ?? "").toLowerCase().includes(query) ||
          skillsText.includes(query) ||
          job.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // 2. Application Status Filter
      const isApplied = appliedJobIds.includes(job.id);
      if (appliedFilter === "applied" && !isApplied) return false;
      if (appliedFilter === "not-applied" && isApplied) return false;

      // 3. Work Mode Filter
      if (workModeFilter !== "all" && (job.workMode ?? "").toLowerCase() !== workModeFilter.toLowerCase()) {
        return false;
      }

      // 4. Employment Type Filter
      if (employmentTypeFilter !== "all" && (job.employmentType ?? "").toLowerCase() !== employmentTypeFilter.toLowerCase()) {
        return false;
      }

      // 5. Department Filter
      if (departmentFilter !== "all" && (job.department ?? "").toLowerCase() !== departmentFilter.toLowerCase()) {
        return false;
      }

      // 6. Location Filter
      if (locationFilter !== "all" && job.location !== locationFilter) {
        return false;
      }

      // 7. Experience Filter
      if (experienceFilter !== "all") {
        const exp = (job.experience ?? "").toLowerCase();
        if (!exp.includes(experienceFilter.toLowerCase())) {
          return false;
        }
      }

      // 8. Date Range Filter
      if (dateRange !== "all") {
        const posted = new Date(job.createdAt).getTime();
        const msPerDay = 86_400_000;
        const cutoff =
          dateRange === "day"
            ? nowMs - 1 * msPerDay
            : dateRange === "week"
            ? nowMs - 7 * msPerDay
            : dateRange === "month"
            ? nowMs - 30 * msPerDay
            : 0;
        if (posted < cutoff) return false;
      }

      return true;
    });
  }, [
    jobs,
    searchQuery,
    appliedJobIds,
    appliedFilter,
    workModeFilter,
    employmentTypeFilter,
    departmentFilter,
    locationFilter,
    experienceFilter,
    dateRange,
    nowMs,
  ]);

  // Sort
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) => {
      if (sortBy === "title-asc") {
        return a.title.localeCompare(b.title);
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [filteredJobs, sortBy]);

  // Active filter count
  const activeFilterCount =
    (searchQuery ? 1 : 0) +
    (appliedFilter !== "all" ? 1 : 0) +
    (workModeFilter !== "all" ? 1 : 0) +
    (employmentTypeFilter !== "all" ? 1 : 0) +
    (departmentFilter !== "all" ? 1 : 0) +
    (locationFilter !== "all" ? 1 : 0) +
    (experienceFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  const resetAllFilters = () => {
    setSearchQuery("");
    setAppliedFilter("all");
    setWorkModeFilter("all");
    setEmploymentTypeFilter("all");
    setDepartmentFilter("all");
    setLocationFilter("all");
    setExperienceFilter("all");
    setDateRange("all");
    setSortBy("newest");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Top Header Navbar */}
      <nav className="h-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-6 sm:px-8 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl ring-1 ring-indigo-100">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">
            Recrutva <span className="text-indigo-600">Careers</span>
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider"
            >
              Recruiter Login
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        {/* Page Hero Title */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3 mr-1" /> Explore Opportunities
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Find Your Next Career Move
          </h1>
          <p className="text-slate-600 text-sm">
            Browse active openings with AI-powered candidate screening and multi-stage evaluation pipelines.
          </p>
        </div>

        {/* Global Keyword Search */}
        <div className="relative max-w-3xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job title, skills, department, or keywords..."
            className="pl-12 pr-10 h-14 bg-white border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-slate-400 focus:ring-indigo-500/20 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Comprehensive Filter Panel ────────────────────────────────── */}
        <Card className="bg-white border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Filter & Refine Jobs
              </span>
              {activeFilterCount > 0 && (
                <Badge className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {activeFilterCount}
                </Badge>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold underline underline-offset-2 cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Filter Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Status Filter Pills */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Application Status
              </label>
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                {(["all", "applied", "not-applied"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAppliedFilter(opt)}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      appliedFilter === opt
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {opt === "all" ? "All" : opt === "applied" ? "Applied" : "Open"}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Work Mode Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Work Mode
              </label>
              <select
                value={workModeFilter}
                onChange={(e) => setWorkModeFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Work Modes</option>
                {uniqueWorkModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Employment Type Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Employment Type
              </label>
              <select
                value={employmentTypeFilter}
                onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Types</option>
                {uniqueEmploymentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Location Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Location
              </label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Department Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* 6. Date Posted Filter */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Date Posted
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">Any Time</option>
                <option value="day">Past 24 Hours</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
              </select>
            </div>

            {/* 7. Sort Order */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title-asc">Title (A - Z)</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase text-slate-400">Active:</span>
              {searchQuery && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Query: {searchQuery}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                </Badge>
              )}
              {appliedFilter !== "all" && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Status: {appliedFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setAppliedFilter("all")} />
                </Badge>
              )}
              {workModeFilter !== "all" && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Mode: {workModeFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setWorkModeFilter("all")} />
                </Badge>
              )}
              {employmentTypeFilter !== "all" && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Type: {employmentTypeFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setEmploymentTypeFilter("all")} />
                </Badge>
              )}
              {locationFilter !== "all" && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Location: {locationFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setLocationFilter("all")} />
                </Badge>
              )}
              {departmentFilter !== "all" && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Dept: {departmentFilter}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setDepartmentFilter("all")} />
                </Badge>
              )}
              {dateRange !== "all" && (
                <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs gap-1">
                  Date: {dateRange}
                  <X className="w-3 h-3 cursor-pointer" onClick={() => setDateRange("all")} />
                </Badge>
              )}
            </div>
          )}
        </Card>

        {/* Results Metadata Header */}
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Showing <span className="text-indigo-600">{sortedJobs.length}</span> {sortedJobs.length === 1 ? "Job" : "Jobs"}
          </p>
        </div>

        {/* Job Listings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedJobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="h-full bg-white border-slate-200/80 rounded-3xl p-6 lg:p-7 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all group flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center ring-1 ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-all text-indigo-600 shrink-0">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {job.workMode && (
                        <Badge className="bg-slate-100 text-slate-700 border-none px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          {job.workMode}
                        </Badge>
                      )}
                      {job.employmentType && (
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                          {job.employmentType}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Title & Dept */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                      {job.title}
                    </h3>
                    {job.department && (
                      <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" /> {job.department}
                      </p>
                    )}
                  </div>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap gap-y-1.5 gap-x-3 text-slate-500 font-medium text-[11px]">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {job.location || "Remote"}
                    </div>
                    {job.salaryRange && (
                      <div className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <DollarSign className="w-3.5 h-3.5" /> {job.salaryRange}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />{" "}
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Description preview */}
                  <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">
                    {job.description}
                  </p>

                  {/* Skills Chips */}
                  {job.requiredSkills && job.requiredSkills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {job.requiredSkills.slice(0, 3).map((skill) => (
                        <Badge
                          key={skill}
                          variant="outline"
                          className="bg-slate-50 border-slate-200 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {job.requiredSkills.length > 3 && (
                        <span className="text-[10px] font-bold text-slate-400 self-center">
                          +{job.requiredSkills.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Section */}
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                  {appliedJobIds.includes(job.id) ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-600 text-[11px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-4 h-4" /> Application Submitted
                      </span>
                      <Link href={`/jobs/${job.id}`}>
                        <Button
                          variant="outline"
                          className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                        >
                          View Details
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <Link href={`/jobs/${job.id}`}>
                      <Button className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold group shadow-xs text-xs">
                        Apply Now{" "}
                        <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Empty Search State */}
        {sortedJobs.length === 0 && !loading && (
          <div className="text-center py-20 bg-white border border-slate-200/80 rounded-3xl p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No matching jobs found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              We couldn&apos;t find any openings matching your selected filters. Try broadening your keywords or clearing specific filter criteria.
            </p>
            <Button
              onClick={resetAllFilters}
              variant="outline"
              className="h-11 px-6 rounded-2xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs uppercase tracking-wider"
            >
              Reset All Filters
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
