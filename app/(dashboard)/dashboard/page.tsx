"use client";

import { motion } from "framer-motion";
import { Users, PhoneCall, CheckCircle2, Sparkles, BarChart3, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useState, useEffect } from "react";
import AddCandidateModal from "@/components/AddCandidateModal";
import { getCandidates } from "@/app/actions/candidate";
import ActivityFeed from "@/components/ActivityFeed";
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

export default function DashboardPage() {
  const { user } = useUser();
  const [candidates, setCandidates] = useState<any[]>([]);

  const fetchCandidates = async () => {
    const data = await getCandidates();
    setCandidates(data);
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const missedCandidates = candidates.filter((candidate) => {
    return (
      candidate.status !== "Completed" &&
      candidate.scheduledAt &&
      new Date(candidate.scheduledAt) < new Date()
    );
  }).length;

  const statusData = [
    { name: "Completed", count: candidates.filter(c => c.status === "Completed").length, color: "#10b981" },
    { name: "Scheduled", count: candidates.filter(c => c.status === "Scheduled").length, color: "#6366f1" },
    { name: "Missed", count: missedCandidates, color: "#ef4444" },
  ];

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
          <AddCandidateModal onSuccess={fetchCandidates} />
        </motion.div>
      </section>

      {/* Stats & Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <StatCard 
            icon={<Users className="text-indigo-400" />} 
            label="Total Pipeline" 
            value={candidates.length.toString()} 
            trend="+12% this week"
          />
          <StatCard 
            icon={<PhoneCall className="text-amber-400" />} 
            label="Active Calls" 
            value={candidates.filter(c => c.status === 'Calling').length.toString()} 
            trend="Sarah is live"
          />
          <StatCard 
            icon={<CheckCircle2 className="text-emerald-400" />} 
            label="Completed" 
            value={candidates.filter(c => c.status === 'Completed').length.toString()} 
            trend="95% Success"
          />
          <StatCard 
            icon={<TrendingUp className="text-purple-400" />} 
            label="Avg. Fit Score" 
            value="8.4" 
            trend="Top Talent"
          />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Candidate Distribution</h3>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Real-time pipeline analytics</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-700" />
            </div>
            
            <div className="h-64 w-full">
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
            </div>
          </Card>
        </div>

        {/* Right Column: Activity Feed */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl h-fit">
             <ActivityFeed />
          </Card>
          
          {/* Quick AI Tip */}
          <Card className="p-6 bg-indigo-600/10 border-indigo-500/20 rounded-[2rem] ring-1 ring-indigo-500/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-widest">AI Recruiter Tip</span>
            </div>
            <p className="text-xs text-indigo-200/70 leading-relaxed">
              Candidates for the <b>Senior React Role</b> are scoring 20% higher when asked about system design. Consider focusing your next batch on these skills.
            </p>
          </Card>
        </div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: string, trend?: string }) {
  return (
    <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] ring-1 ring-white/5 flex flex-col gap-4 group hover:border-indigo-500/30 transition-all cursor-default shadow-xl">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center ring-1 ring-white/5 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {trend && <span className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-tighter">{trend}</span>}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-none mb-2">{label}</p>
        <p className="text-3xl font-black text-white leading-none">{value}</p>
      </div>
    </Card>
  );
}
