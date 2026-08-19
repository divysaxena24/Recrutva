"use client";

import { motion } from "framer-motion";
import { Users, PhoneCall, CheckCircle2, Sparkles, BarChart3, TrendingUp, Briefcase, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useState, useEffect } from "react";
import AddCandidateModal from "@/components/AddCandidateModal";
import { getDashboardStats } from "@/app/actions/candidate";
import { useUser } from "@clerk/nextjs";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

interface DashboardStats {
  activeJobs: number;
  totalApplicants: number;
  completedInterviews: number;
  avgFitScore: string;
  recentApplicants: {
    id: number;
    name: string;
    status: string;
    jobTitle: string | null;
    createdAt: Date;
    scheduledAt: Date | null;
  }[];
}

function getStatusInfo(status: string) {
  switch (status) {
    case "Completed":
      return { text: "completed their interview", icon: CheckCircle2, color: "text-emerald-400" };
    case "Scheduled":
      return { text: "has an interview scheduled", icon: Clock, color: "text-indigo-400" };
    case "Calling":
      return { text: "is on an active call", icon: PhoneCall, color: "text-amber-400" };
    default:
      return { text: "was added to the pipeline", icon: Users, color: "text-slate-400" };
  }
}

function timeAgo(date: Date): string {
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

export default function DashboardPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    const data = await getDashboardStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const statusData = stats
    ? [
        { name: "Completed", count: stats.completedInterviews, color: "#10b981" },
        { name: "Active", count: stats.totalApplicants - stats.completedInterviews, color: "#6366f1" },
      ]
    : [];

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Hero Section */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Sparkles className="w-4 h-4" /> Hiring Command Center
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.firstName || "Recruiter"}
          </h1>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4"
        >
          <AddCandidateModal onSuccess={fetchStats} />
        </motion.div>
      </section>

      {/* Stats & Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <StatCard 
            icon={<Briefcase className="text-indigo-400" />} 
            label="Active Jobs" 
            value={loading ? "—" : String(stats?.activeJobs ?? 0)}
          />
          <StatCard 
            icon={<Users className="text-amber-400" />} 
            label="Total Applicants" 
            value={loading ? "—" : String(stats?.totalApplicants ?? 0)}
          />
          <StatCard 
            icon={<CheckCircle2 className="text-emerald-400" />} 
            label="Interviews Completed" 
            value={loading ? "—" : String(stats?.completedInterviews ?? 0)}
          />
          <StatCard 
            icon={<TrendingUp className="text-purple-400" />} 
            label="Avg. Fit Score" 
            value={loading ? "—" : stats && Number(stats.avgFitScore) > 0 ? `${stats.avgFitScore}/100` : "No data"}
          />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Candidate Distribution</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Pipeline status overview</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-700" />
            </div>
            
            <div className="h-64 w-full">
              {loading || !stats || stats.totalApplicants === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No candidates yet</p>
                  <p className="text-xs text-slate-600 mt-1">Add candidates to see pipeline analytics</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Activity Feed */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl h-fit">
             {/* Activity Feed — now DB-driven */}
             <div className="space-y-6">
               <div className="flex items-center justify-between">
                 <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                   <Clock className="w-4 h-4 text-indigo-400" />
                   Recent Activity
                 </h3>
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Latest</span>
               </div>
               
               <div className="space-y-4">
                 {loading || !stats ? (
                   <p className="text-xs text-slate-500 italic">Loading...</p>
                 ) : stats.recentApplicants.length === 0 ? (
                   <p className="text-xs text-slate-500 italic">No activity yet. Add candidates to get started.</p>
                 ) : (
                   stats.recentApplicants.map((applicant, i) => {
                     const info = getStatusInfo(applicant.status);
                     const Icon = info.icon;
                     return (
                       <motion.div 
                         key={applicant.id}
                         initial={{ opacity: 0, x: -10 }}
                         animate={{ opacity: 1, x: 0 }}
                         transition={{ delay: i * 0.1 }}
                         className="flex gap-4 p-3 rounded-xl hover:bg-white/[0.02] transition-colors border border-transparent hover:border-slate-800/60"
                       >
                         <div className={`mt-0.5 p-2 rounded-lg bg-white/[0.03] ring-1 ring-white/5 ${info.color}`}>
                           <Icon className="w-4 h-4" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-sm text-slate-300 leading-snug">
                             <span className="font-semibold text-white">{applicant.name}</span>{" "}
                             {info.text}
                             {applicant.jobTitle && (
                               <> for <span className="text-indigo-400">{applicant.jobTitle}</span></>
                             )}
                           </p>
                           <span className="text-[10px] text-slate-500 font-medium mt-1 inline-block">
                             {timeAgo(applicant.createdAt)}
                           </span>
                         </div>
                       </motion.div>
                     );
                   })
                 )}
               </div>
             </div>
          </Card>
          
          {/* Tip Card — neutral state, no fake data */}
          <Card className="p-6 bg-indigo-600/10 border-indigo-500/20 rounded-[2rem] ring-1 ring-indigo-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-widest">Quick Tip</span>
            </div>
            <p className="text-xs text-indigo-200/70 leading-relaxed">
              {stats && stats.totalApplicants > 0
                ? `You have ${stats.totalApplicants} applicant${stats.totalApplicants === 1 ? "" : "s"} across your jobs. Review completed interviews to identify top candidates.`
                : "Create a job and add candidates to start building your hiring pipeline."}
            </p>
          </Card>
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] ring-1 ring-white/5 flex flex-col gap-4 group hover:border-indigo-500/30 transition-all cursor-default shadow-xl">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center ring-1 ring-white/5 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mb-2">{label}</p>
        <p className="text-3xl font-black text-white leading-none">{value}</p>
      </div>
    </Card>
  );
}
