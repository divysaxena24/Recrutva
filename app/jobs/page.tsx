"use client";

import { motion } from "framer-motion";
import { Briefcase, MapPin, Calendar, Search, Sparkles, ArrowRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { getAllJobs } from "@/app/actions/job";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PublicJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllJobs().then(data => {
      setJobs(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 font-sans pb-20">
      {/* Navbar */}
      <nav className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/20">
            <Briefcase className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="font-bold text-xl tracking-tight">Recrutva <span className="text-indigo-500">Careers</span></span>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5 font-bold">Recruiter Login</Button>
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-8">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors group cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      {/* Hero */}
      <section className="pt-20 pb-12 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <Badge className="bg-indigo-500/10 text-indigo-400 border-none px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">Open Opportunities</Badge>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">Shape the future <br /> with <span className="text-indigo-500">Recrutva.</span></h1>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto">Browse our latest job openings and apply to start your AI-powered screening journey.</p>
        </motion.div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 space-y-12">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input 
            placeholder="Search by role or location..." 
            className="pl-12 h-16 bg-[#0a0a0f] border-slate-800 rounded-2xl text-lg focus:ring-indigo-500/50 shadow-2xl"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {jobs.map((job, i) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="h-full bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] p-8 ring-1 ring-white/5 hover:border-indigo-500/40 transition-all group flex flex-col justify-between shadow-2xl">
                <div className="space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                    <Briefcase className="w-7 h-7 text-indigo-400" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">{job.title}</h3>
                    <div className="flex flex-col gap-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                       <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-indigo-500/50" /> {job.location}</div>
                       <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-indigo-500/50" /> {new Date(job.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-4">
                    {job.description}
                  </p>
                </div>

                <div className="mt-10 pt-6 border-t border-white/5">
                  <Link href={`/jobs/${job.id}`}>
                    <Button className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold group shadow-xl shadow-indigo-500/20">
                      Apply Now <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {jobs.length === 0 && !loading && (
          <div className="text-center py-20">
             <Briefcase className="w-16 h-16 text-slate-800 mx-auto mb-6 opacity-20" />
             <p className="text-slate-500 text-xl italic font-medium">No open roles at the moment. Check back soon!</p>
          </div>
        )}
      </main>
    </div>
  );
}
