"use client";

import { motion } from "framer-motion";
import { Briefcase, User, Sparkles, ArrowRight, Bot, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] opacity-20 pointer-events-none blur-[120px] bg-indigo-500 rounded-full" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] opacity-10 pointer-events-none blur-[100px] bg-purple-500 rounded-full" />

      <button 
        onClick={() => router.back()}
        className="absolute top-8 left-8 z-20 flex items-center gap-2 text-slate-500 hover:text-white transition-colors group px-4 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm cursor-pointer"
      >
        <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
        <span className="text-xs font-bold uppercase tracking-widest">Back</span>
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full text-center space-y-12 relative z-10"
      >
        <div className="space-y-4">
          <Badge className="bg-indigo-500/10 text-indigo-400 border-none px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Welcome to Recrutva
          </Badge>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
            How will you use <span className="text-indigo-500">Recrutva</span> today?
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">
            Hey {user?.firstName || "there"}! Choose your path to get started with our AI-powered recruitment ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Recruiter Path */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group"
          >
            <Link href="/dashboard">
              <Card className="h-full bg-[#0a0a0f] border-slate-800/60 p-10 rounded-[3rem] ring-1 ring-white/5 hover:border-indigo-500/40 transition-all shadow-2xl flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-500">
                  <Users className="w-10 h-10 text-indigo-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Hiring Manager</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Create job posts, manage your talent pipeline, and launch AI voice screenings.
                  </p>
                </div>
                <Button className="w-full h-14 rounded-2xl bg-indigo-600 group-hover:bg-indigo-500 font-bold transition-all">
                  Enter Hiring Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Card>
            </Link>
          </motion.div>

          {/* Candidate Path */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group"
          >
            <Link href="/candidate-dashboard">
              <Card className="h-full bg-[#0a0a0f] border-slate-800/60 p-10 rounded-[3rem] ring-1 ring-white/5 hover:border-emerald-500/40 transition-all shadow-2xl flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center ring-1 ring-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                  <Briefcase className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white">Candidate</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Explore active job openings, apply with your resume, and track your interviews.
                  </p>
                </div>
                <Button className="w-full h-14 rounded-2xl bg-emerald-600 group-hover:bg-emerald-500 font-bold border-none transition-all">
                  Go to Job Board <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Card>
            </Link>
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-6 pt-8">
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
              <Sparkles className="w-3 h-3 text-indigo-500" /> AI Ready
           </div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
              <Bot className="w-3 h-3 text-indigo-500" /> Real-time Voice
           </div>
        </div>
      </motion.div>
    </div>
  );
}
