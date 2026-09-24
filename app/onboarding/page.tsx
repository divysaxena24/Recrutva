"use client";

import { motion } from "framer-motion";
import { Briefcase, Sparkles, ArrowRight, Bot, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setUserRole } from "@/app/actions/auth";

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState<"RECRUITER" | "CANDIDATE" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRoleSelection = async (role: "RECRUITER" | "CANDIDATE") => {
    setLoading(role);
    setError(null);

    try {
      const result = await setUserRole(role);

      if (result.success && result.redirectPath) {
        router.push(result.redirectPath);
      } else if (result.redirectPath) {
        // Role already set — redirect to their dashboard
        router.push(result.redirectPath);
      } else {
        setError(result.error || "Failed to set role. Please try again.");
        setLoading(null);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] opacity-30 pointer-events-none blur-[120px] bg-indigo-200 rounded-full" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] opacity-30 pointer-events-none blur-[100px] bg-purple-200 rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full text-center space-y-12 relative z-10"
      >
        <div className="space-y-4">
          <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xs">
            Welcome to Recrutva
          </Badge>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight">
            How will you use <span className="text-indigo-600">Recrutva</span> today?
          </h1>
          <p className="text-slate-600 text-lg max-w-xl mx-auto font-medium">
            Hey {user?.firstName || "there"}! Choose your path to get started with our AI-powered recruitment ecosystem.
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 max-w-md mx-auto">
            <p className="text-xs text-rose-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Recruiter Path */}
          <motion.div 
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className="group"
          >
            <Card 
              className={`h-full bg-white border-slate-200/80 p-10 rounded-[3rem] hover:border-indigo-300 transition-all shadow-xs hover:shadow-md flex flex-col items-center text-center space-y-6 ${loading && loading !== "RECRUITER" ? "opacity-50" : ""}`}
            >
              <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center ring-1 ring-indigo-100 group-hover:bg-indigo-600 transition-all duration-500">
                <Users className="w-10 h-10 text-indigo-600 group-hover:text-white transition-colors" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Hiring Manager</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Create job posts, manage your talent pipeline, and launch AI voice screenings.
                </p>
              </div>
              <Button 
                onClick={() => handleRoleSelection("RECRUITER")}
                disabled={loading !== null}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md shadow-indigo-600/15"
              >
                {loading === "RECRUITER" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <>Enter Hiring Dashboard <ArrowRight className="ml-2 w-4 h-4" /></>
                )}
              </Button>
            </Card>
          </motion.div>

          {/* Candidate Path */}
          <motion.div 
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className="group"
          >
            <Card className={`h-full bg-white border-slate-200/80 p-10 rounded-[3rem] hover:border-emerald-300 transition-all shadow-xs hover:shadow-md flex flex-col items-center text-center space-y-6 ${loading && loading !== "CANDIDATE" ? "opacity-50" : ""}`}>
              <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100 group-hover:bg-emerald-600 transition-all duration-500">
                <Briefcase className="w-10 h-10 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Candidate</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Explore active job openings, apply with your resume, and track your interviews.
                </p>
              </div>
              <Button 
                onClick={() => handleRoleSelection("CANDIDATE")}
                disabled={loading !== null}
                className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/15"
              >
                {loading === "CANDIDATE" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <>Go to Job Board <ArrowRight className="ml-2 w-4 h-4" /></>
                )}
              </Button>
            </Card>
          </motion.div>
        </div>

        <div className="flex items-center justify-center gap-6 pt-8">
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              <Sparkles className="w-3 h-3 text-indigo-600" /> AI Ready
           </div>
           <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              <Bot className="w-3 h-3 text-indigo-600" /> Real-time Voice
           </div>
        </div>
      </motion.div>
    </div>
  );
}
