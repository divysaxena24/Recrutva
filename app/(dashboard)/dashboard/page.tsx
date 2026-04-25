"use client";

import { motion } from "framer-motion";
import { Plus, Users, PhoneCall, CheckCircle2, Search, Filter, Sparkles, BarChart3, TrendingUp, Briefcase, Calendar } from "lucide-react";
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
import { useState, useEffect } from "react";
import AddCandidateModal from "@/components/AddCandidateModal";
import EditCandidateModal from "@/components/EditCandidateModal";
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
  AreaChart,
  Area,
  Cell
} from "recharts";

export default function DashboardPage() {
  const { user } = useUser();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCandidate, setEditingCandidate] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    const data = await getCandidates();
    setCandidates(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Chart Data preparation
  const statusData = [
    { name: "Ready", count: candidates.filter(c => c.status === "Ready").length, color: "#64748b" },
    { name: "Calling", count: candidates.filter(c => c.status === "Calling").length, color: "#f59e0b" },
    { name: "Completed", count: candidates.filter(c => c.status === "Completed").length, color: "#10b981" },
    { name: "Scheduled", count: candidates.filter(c => c.status === "Scheduled").length, color: "#6366f1" },
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
          <p className="text-slate-400 text-lg max-w-xl">
            You have <span className="text-white font-bold">{candidates.filter(c => c.status === 'Ready').length} candidates</span> waiting for AI screening today.
          </p>
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
        {/* Analytics Column */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Main Chart */}
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

          {/* Candidate Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-[#0a0a0f] border-slate-800/60 overflow-hidden rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
              <div className="p-8 border-b border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.01]">
                <div>
                  <h3 className="font-bold text-white text-xl tracking-tight">Live Pipeline</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Active Recruitments</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <Input 
                      placeholder="Find candidate..." 
                      className="pl-9 h-10 w-48 bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-10 border-slate-800 bg-transparent text-slate-400 rounded-xl px-4">
                    <Filter className="w-3.5 h-3.5 mr-2" /> Filter
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-slate-800/60 hover:bg-transparent uppercase tracking-wider text-[10px]">
                    <TableHead className="text-slate-500 font-bold py-6 px-8">Candidate</TableHead>
                    <TableHead className="text-slate-500 font-bold">Assigned Role</TableHead>
                    <TableHead className="text-slate-500 font-bold">Interview Date</TableHead>
                    <TableHead className="text-slate-500 font-bold">Status</TableHead>
                    <TableHead className="text-slate-500 font-bold text-right px-8">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate, i) => (
                    <motion.tr 
                      key={candidate.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (i * 0.05) }}
                      className="border-slate-800/40 hover:bg-white/[0.02] transition-colors group cursor-default"
                    >
                      <TableCell className="py-6 px-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            {candidate.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{candidate.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{candidate.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div 
                          onClick={() => candidate.targetJobId && (window.location.href = `/jobs/${candidate.targetJobId}`)}
                          className={`flex items-center gap-2 font-medium transition-colors ${candidate.targetJobId ? 'text-indigo-400 hover:text-indigo-300 cursor-pointer' : 'text-slate-300'}`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span className="text-xs truncate max-w-[120px]">{candidate.jobTitle || candidate.linkedJobTitle || "General Role"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-slate-400 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-xs">
                            {candidate.scheduledAt ? new Date(candidate.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "Not Scheduled"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={candidate.status} />
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <div className="flex flex-col items-end gap-2">
                           <div className="flex items-center gap-2">
                             <span className={`text-sm font-black ${candidate.score !== "-" ? 'text-indigo-400' : 'text-slate-700'}`}>
                                {candidate.score || "-"}
                             </span>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               onClick={async () => {
                                 if (candidate.status === 'Ready') {
                                   const { inviteCandidate } = await import("@/app/actions/invite");
                                   await inviteCandidate(candidate.id);
                                   fetchCandidates();
                                 } else {
                                   window.location.href = `/interview/${candidate.id}`;
                                 }
                               }}
                               className="h-8 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                             >
                                {candidate.status === "Ready" ? "Initiate AI Interview" : "Open Portal"}
                             </Button>
                             <Button 
                               variant="ghost" 
                               size="sm" 
                               onClick={() => {
                                 setEditingCandidate(candidate);
                                 setIsEditModalOpen(true);
                               }}
                               className="h-8 text-[10px] font-bold text-slate-500 hover:text-white hover:bg-white/5 rounded-lg ml-2"
                             >
                               Edit
                             </Button>
                           </div>
                           {candidate.matchScore && (
                             <span className="text-[9px] text-emerald-500 font-bold uppercase">Match: {candidate.matchScore}%</span>
                           )}
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
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

      <EditCandidateModal 
        candidate={editingCandidate}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={fetchCandidates}
      />
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Ready: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    Calling: "bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse",
    Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    Scheduled: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };

  return (
    <Badge variant="outline" className={`${styles[status] || styles.Ready} px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider`}>
      {status}
    </Badge>
  );
}
