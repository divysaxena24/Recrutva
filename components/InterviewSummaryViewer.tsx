'use client';

import { motion } from "framer-motion";
import { Bot, ShieldCheck, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function InterviewSummaryViewer({ analysis, name }: { analysis: any; name: string }) {
  const router = useRouter();
  const totalScore = analysis?.totalScore ?? null;
  const breakdown: any[] = analysis?.breakdown ?? [];
  const summary = analysis?.executiveSummary ?? analysis?.summary ?? null;

  const scoreColor = totalScore === null ? "text-slate-400"
    : totalScore >= 75 ? "text-emerald-400"
    : totalScore >= 50 ? "text-amber-400"
    : "text-red-400";

  const scoreBarColor = totalScore === null ? "bg-slate-600"
    : totalScore >= 75 ? "bg-emerald-500"
    : totalScore >= 50 ? "bg-amber-500"
    : "bg-red-500";

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 flex flex-col items-center px-6 py-16 relative overflow-y-auto font-sans">
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] opacity-10 pointer-events-none blur-[140px] bg-emerald-500 rounded-full" />
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] opacity-10 pointer-events-none blur-[140px] bg-indigo-500 rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl w-full space-y-8 relative z-10"
      >
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Interview Complete
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mt-2">Your Results, {name}</h1>
          <p className="text-slate-400">Here is your full AI-generated performance breakdown.</p>
        </div>

        <Card className="p-8 bg-[#0a0a0f] border-slate-800/60 rounded-[2.5rem] ring-1 ring-white/5 shadow-2xl flex flex-col md:flex-row items-center gap-8">
          <div className="text-center md:text-left shrink-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Final Score</p>
            {totalScore !== null ? (
              <div className={`text-8xl font-black tabular-nums leading-none ${scoreColor}`}>
                {totalScore}<span className="text-3xl text-slate-600 font-bold">/100</span>
              </div>
            ) : (
              <div className="text-4xl font-black text-slate-500">Pending Analysis</div>
            )}
          </div>
          <div className="flex-1 w-full space-y-4">
            {totalScore !== null && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 font-bold mb-2 uppercase tracking-widest">
                  <span>Score</span><span>{totalScore}%</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${totalScore}%` }}
                    transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                    className={`h-full rounded-full ${scoreBarColor}`}
                  />
                </div>
              </div>
            )}
            {summary && (
              <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/40 pl-4">
                &ldquo;{summary}&rdquo;
              </p>
            )}
            {!analysis && (
              <p className="text-sm text-slate-400">This interview was completed before detailed analysis was enabled. The breakdown will appear here for future interviews.</p>
            )}
          </div>
        </Card>

        {breakdown.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
              Question-by-Question Breakdown
            </h2>
            {breakdown.map((item: any, i: number) => {
              const marks = item.marks ?? 0;
              const markColor = marks >= 7 ? "text-emerald-400" : marks >= 4 ? "text-amber-400" : "text-red-400";
              const markBarColor = marks >= 7 ? "bg-emerald-500" : marks >= 4 ? "bg-amber-500" : "bg-red-500";

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                >
                  <Card className="bg-[#0c0c14] border-slate-800/50 rounded-[2rem] overflow-hidden">
                    <div className="flex items-start justify-between gap-4 p-6 pb-4">
                      <div className="space-y-1 flex-1">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Question {i + 1}</span>
                        <p className="text-sm font-semibold text-white leading-snug">{item.question}</p>
                      </div>
                      <div className="shrink-0 text-center min-w-[60px]">
                        <div className={`text-2xl font-black tabular-nums leading-none ${markColor}`}>
                          {marks}<span className="text-slate-600 text-sm font-bold">/10</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full ${markBarColor}`} style={{ width: `${marks * 10}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6 space-y-3">
                      <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Bot className="w-3 h-3" /> Expected Answer
                        </span>
                        <p className="text-sm text-indigo-100/80 leading-relaxed">{item.expectedAnswer}</p>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <User className="w-3 h-3" /> Your Answer
                        </span>
                        <p className="text-sm text-slate-300 italic leading-relaxed">&ldquo;{item.userAnswer || "[No answer recorded]"}&rdquo;</p>
                      </div>

                      <div className={`rounded-2xl p-4 space-y-1.5 border ${marks >= 7 ? "bg-emerald-500/5 border-emerald-500/15" : marks >= 4 ? "bg-amber-500/5 border-amber-500/15" : "bg-red-500/5 border-red-500/15"}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${markColor}`}>
                          <Sparkles className="w-3 h-3" /> Marks Awarded: {marks} / 10
                        </span>
                        <p className="text-sm text-slate-300 leading-relaxed">{item.feedback}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {totalScore !== null && (
          <Card className="p-6 bg-[#0a0a0f] border-slate-800/60 rounded-[2rem] ring-1 ring-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Overall Performance</p>
              <p className={`text-2xl font-extrabold ${scoreColor}`}>
                {totalScore >= 75 ? "Excellent" : totalScore >= 50 ? "Good" : "Needs Improvement"}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {totalScore >= 75
                  ? "Outstanding performance, highly recommended."
                  : totalScore >= 50
                    ? "Solid candidate with room to grow."
                    : "Candidate may need more preparation."}
              </p>
            </div>
            <div className={`text-5xl font-black tabular-nums ${scoreColor}`}>
              {totalScore}<span className="text-slate-600 text-2xl font-bold">/100</span>
            </div>
          </Card>
        )}

        <div className="pb-12">
          <Button
            onClick={() => router.push("/dashboard")}
            className="w-full h-16 rounded-3xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-xl shadow-indigo-500/20 transition-all"
          >
            Return to Dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
