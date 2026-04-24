"use client";

import { motion } from "framer-motion";
import { Plus, Users, PhoneCall, CheckCircle2, Search, Filter, Sparkles } from "lucide-react";
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
import { getCandidates } from "@/app/actions/candidate";
import ActivityFeed from "@/components/ActivityFeed";
import { useUser } from "@clerk/nextjs";

export default function DashboardPage() {
  const { user } = useUser();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCandidates = async () => {
    setLoading(true);
    const data = await getCandidates();
    setCandidates(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

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
        >
          <AddCandidateModal onSuccess={fetchCandidates} />
        </motion.div>
      </section>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Column: Candidates & Stats */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>

          {/* Candidate Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-[#0a0a0f] border-slate-800/60 overflow-hidden rounded-3xl ring-1 ring-white/5 shadow-2xl">
              <div className="p-6 border-b border-slate-800/60 flex items-center justify-between bg-white/[0.01]">
                <h3 className="font-bold text-white tracking-tight">Active Candidates</h3>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <Input 
                      placeholder="Find candidate..." 
                      className="pl-9 h-9 w-48 bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
                    />
                  </div>
                  <Button variant="outline" size="sm" className="h-9 border-slate-800 bg-transparent text-slate-400 rounded-xl">
                    <Filter className="w-3.5 h-3.5 mr-2" /> Sort
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-slate-800/60 hover:bg-transparent uppercase tracking-wider text-[10px]">
                    <TableHead className="text-slate-500 font-bold py-5 px-6">Candidate Information</TableHead>
                    <TableHead className="text-slate-500 font-bold">Status</TableHead>
                    <TableHead className="text-slate-500 font-bold">Fit Score</TableHead>
                    <TableHead className="text-right text-slate-500 font-bold px-6">Action</TableHead>
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
                      <TableCell className="py-5 px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                            {candidate.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{candidate.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{candidate.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={candidate.status} />
                      </TableCell>
                      <TableCell>
                        {candidate.score !== "-" ? (
                          <div className="flex items-center gap-2">
                             <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${parseFloat(candidate.score) * 10}%` }} />
                             </div>
                             <span className="text-xs font-bold text-indigo-400">{candidate.score}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 font-medium italic">Pending Output</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg">
                          {candidate.status === "Ready" ? "Initiate Call" : "Open Report"}
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                  {candidates.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-48 text-center text-slate-500 italic">
                        No candidates found. Start by importing your first recruit!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Activity Feed */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-1"
        >
          <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-3xl ring-1 ring-white/5 sticky top-6 shadow-2xl h-fit">
             <ActivityFeed />
          </Card>
        </motion.div>

      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode, label: string, value: string, trend?: string }) {
  return (
    <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-3xl ring-1 ring-white/5 flex flex-col gap-4 group hover:border-indigo-500/30 transition-all cursor-default">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center ring-1 ring-white/5 group-hover:scale-110 transition-transform">
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
    <Badge variant="outline" className={`${styles[status] || styles.Ready} px-3 py-1 rounded-full text-[11px] font-semibold border`}>
      {status}
    </Badge>
  );
}
