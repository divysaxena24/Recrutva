"use client";

import { motion } from "framer-motion";
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  ArrowRight, 
  FileText,
  AlertCircle,
  Play,
  ClipboardCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { getCandidateApplications } from "@/app/actions/candidate-dashboard";
import Link from "next/link";

export default function CandidateDashboardPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    getCandidateApplications().then(data => {
      setApplications(data);
      setLoading(false);
    });

    // Real-time polling every 5 seconds
    const interval = setInterval(() => {
      getCandidateApplications().then(data => {
        setApplications(data);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'scheduled': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'ready': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center text-slate-500 font-bold animate-pulse">Loading your applications...</div>;

  return (
    <div className="space-y-10">
      <section>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Welcome Back!</h1>
          <p className="text-slate-400 text-lg">Track your AI interview progress and job applications.</p>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats Summary */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-emerald-600/5 border-emerald-500/20 p-6 rounded-3xl">
             <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4">Total Applications</h3>
             <div className="text-5xl font-black text-white">{applications.length}</div>
          </Card>
          
          <Card className="bg-indigo-600/5 border-indigo-500/20 p-6 rounded-3xl">
             <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-2">Next Step</h3>
             <p className="text-sm text-slate-400 mb-4">You have {applications.filter(a => a.status === 'Scheduled').length} upcoming AI interviews.</p>
             <Link href="/jobs">
               <Button className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold">Explore More Jobs</Button>
             </Link>
          </Card>
        </div>

        {/* Applications List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-2">
             <h3 className="text-xl font-bold text-white">Your Applications</h3>
             <Badge variant="outline" className="border-slate-800 text-slate-500">Live Status</Badge>
          </div>

          <div className="space-y-4">
            {applications.length === 0 ? (
              <Card className="bg-[#0a0a0f] border-slate-800/60 p-12 text-center rounded-[2.5rem]">
                <Briefcase className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-30" />
                <p className="text-slate-500 font-medium italic">You haven't applied to any jobs yet.</p>
                <Link href="/jobs" className="mt-4 inline-block text-indigo-400 font-bold hover:underline">Start browsing roles</Link>
              </Card>
            ) : (
              applications.map((app, i) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Card className="bg-[#0a0a0f] border-slate-800/60 p-6 rounded-3xl hover:border-white/10 transition-all group">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{app.jobTitle || "General Application"}</h4>
                          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                             <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Applied {new Date(app.createdAt).toLocaleDateString()}</span>
                             {app.scheduledAt && (
                               <span className="flex items-center gap-1 text-indigo-500/70"><Calendar className="w-3 h-3" /> {new Date(app.scheduledAt).toLocaleString()}</span>
                             )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 ml-auto flex-wrap justify-end">
                        <Badge className={`px-3 py-1 rounded-full border ${getStatusColor(app.status)}`}>
                          {app.status}
                        </Badge>

                        {app.assessmentAvailable && (
                          <Link href={`/assessment/${app.id}`}>
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-2">
                              <ClipboardCheck className="w-3.5 h-3.5" /> Take Assessment
                            </Button>
                          </Link>
                        )}

                        {app.assessmentCompleted && app.assessmentStatus && (
                          <Badge
                            variant="outline"
                            className={
                              app.assessmentStatus === "PASSED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold"
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20 px-3 py-1 rounded-full text-[10px] font-bold"
                            }
                          >
                            Assessment {app.assessmentStatus === "PASSED" ? "Passed" : "Failed"}
                          </Badge>
                        )}

                        {app.status === 'Scheduled' && (
                          <Link href={`/interview/${app.id}`}>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center gap-2">
                              <Play className="w-3.5 h-3.5 fill-current" /> Start Interview
                            </Button>
                          </Link>
                        )}

                        {app.status === 'Completed' && app.score && (
                           <div className="text-right">
                              <div className="text-[10px] text-slate-600 font-bold uppercase">AI Score</div>
                              <div className="text-lg font-black text-emerald-400">{app.score}/100</div>
                           </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
