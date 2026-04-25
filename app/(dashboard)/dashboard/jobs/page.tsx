"use client";

import { motion } from "framer-motion";
import { Briefcase, MapPin, Calendar, Search, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { getJobs, deleteJob } from "@/app/actions/job";
import AddJobModal from "@/components/AddJobModal";
import { useUser } from "@clerk/nextjs";

export default function JobsPage() {
  const { user } = useUser();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    const data = await getJobs();
    setJobs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return true;

    return (
      job.title.toLowerCase().includes(query) ||
      job.location.toLowerCase().includes(query) ||
      job.description.toLowerCase().includes(query)
    );
  });

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this job?")) {
      const res = await deleteJob(id);
      if (res.success) {
        fetchJobs();
      }
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Briefcase className="w-4 h-4" /> Management
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Job Management
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Create and manage public job listings. All jobs are visible to potential candidates.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <AddJobModal onSuccess={fetchJobs} />
        </motion.div>
      </section>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search jobs by title or location..."
          className="pl-10 h-12 bg-[#0a0a0f] border-slate-800/60 rounded-2xl text-sm focus:ring-indigo-500/50"
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
            <Card className="h-full bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] p-6 ring-1 ring-white/5 flex flex-col justify-between group hover:border-indigo-500/30 transition-all shadow-xl">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center ring-1 ring-indigo-500/20">
                    <Briefcase className="w-6 h-6 text-indigo-400" />
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                    {job.status}
                  </Badge>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {job.title} <span className="text-slate-600 text-sm font-medium ml-1">(#{job.id.toString().padStart(4, '0')})</span>
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-slate-500 text-xs font-medium uppercase tracking-wider">
                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {job.location}</div>
                    <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(job.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed">
                  {job.description}
                </p>

                <div className="flex items-center gap-2 text-indigo-400/80 text-[10px] font-bold uppercase tracking-widest">
                   <Globe className="w-3 h-3" /> Publicly Listed
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {job.userId === user?.id && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)} className="w-9 h-9 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 text-slate-600 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => window.location.href = '/dashboard/candidates'}
                        className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20"
                      >
                        View Candidates
                      </Button>
                    </>
                  )}
                </div>
                <Button 
                    variant="outline"
                    size="sm" 
                    onClick={() => window.location.href = `/jobs/${job.id}`}
                    className="h-9 px-4 rounded-xl border-slate-800 text-slate-400 hover:bg-white/5 text-[10px] font-bold uppercase"
                  >
                    View Application
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}

        {filteredJobs.length === 0 && !loading && (
          <Card className="col-span-full h-64 border-dashed border-slate-800 bg-transparent flex flex-col items-center justify-center text-slate-500">
            <Briefcase className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium italic">
              {jobs.length === 0 ? "No job roles created yet. Start by posting a new opportunity." : "No jobs match your search."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
