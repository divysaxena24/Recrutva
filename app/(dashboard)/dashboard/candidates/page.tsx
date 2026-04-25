"use client";

import { motion } from "framer-motion";
import { Users, Search, Filter, Sparkles, MoreVertical, Briefcase } from "lucide-react";
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

export default function CandidatesPage() {
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

  return (
    <div className="space-y-10 pb-20">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Users className="w-4 h-4" /> Talent Pool
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Candidate Pipeline
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            Track and manage every recruit in your ecosystem.
          </p>
        </motion.div>
        
        <AddCandidateModal onSuccess={fetchCandidates} />
      </section>

      <Card className="bg-[#0a0a0f] border-slate-800/60 overflow-hidden rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl">
        <div className="p-8 border-b border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <Input 
                placeholder="Search candidates..." 
                className="pl-9 h-10 w-64 bg-slate-950 border-slate-800 text-xs rounded-xl focus:ring-indigo-500/50"
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
              <TableHead className="text-slate-500 font-bold">Status</TableHead>
              <TableHead className="text-slate-500 font-bold text-right px-8">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidates.map((candidate, i) => (
              <TableRow 
                key={candidate.id}
                className="border-slate-800/40 hover:bg-white/[0.02] transition-colors group cursor-default"
              >
                <TableCell className="py-6 px-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      {candidate.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm group-hover:text-indigo-300 transition-colors">{candidate.name}</div>
                      <div className="text-[11px] text-slate-500">{candidate.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div 
                    onClick={() => candidate.targetJobId && (window.location.href = `/jobs/${candidate.targetJobId}`)}
                    className={`flex items-center gap-2 font-medium transition-colors ${candidate.targetJobId ? 'text-indigo-400 hover:text-indigo-300 cursor-pointer' : 'text-slate-300'}`}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span className="text-xs">{candidate.jobTitle || "General Role"}</span>
                  </div>
                </TableCell>
                <TableCell>
                   <StatusBadge status={candidate.status} />
                </TableCell>
                <TableCell className="text-right px-8">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setEditingCandidate(candidate);
                      setIsEditModalOpen(true);
                    }}
                    className="w-8 h-8 rounded-lg hover:bg-white/5 text-slate-600 hover:text-indigo-400 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <EditCandidateModal 
        candidate={editingCandidate}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSuccess={fetchCandidates}
      />
    </div>
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
