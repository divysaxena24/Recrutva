"use client";

import { motion } from "framer-motion";
import { Calendar, Clock, User, Video, CheckCircle2, AlertCircle, CalendarClock, Link as LinkIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCandidates, rescheduleCandidate } from "@/app/actions/candidate";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/** A candidate row as returned by the getCandidates server action. */
type Candidate = Awaited<ReturnType<typeof getCandidates>>[number];

export default function SchedulesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [reschedulingCandidate, setReschedulingCandidate] =
    useState<Candidate | null>(null);
  const [newDate, setNewDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Loader shared by the mount effect and the reschedule refresh. State is only
  // written from promise callbacks: React forbids setState calls made
  // synchronously from an effect, directly or through a called function.
  const loadCandidates = useCallback(() => {
    return getCandidates()
      .then((data) => {
        setCandidates(
          data.filter(
            (c) =>
              c.scheduledAt ||
              c.status === "Completed" ||
              c.status === "Scheduled"
          )
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const fetchCandidates = useCallback(() => {
    setLoading(true);
    return loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const [dateError, setDateError] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const handleReschedule = async () => {
    if (!reschedulingCandidate) return;

    setDateError(null);
    setRescheduleError(null);

    if (!newDate) {
      setDateError("Please select a new date and time");
      return;
    }

    const parsed = Date.parse(newDate);
    if (isNaN(parsed)) {
      setDateError("Please enter a valid date and time");
      return;
    }

    if (parsed < Date.now() - 15 * 60 * 1000) {
      setDateError("Rescheduled interview date must be in the future");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await rescheduleCandidate(reschedulingCandidate.id, newDate);
      if (res.success) {
        setReschedulingCandidate(null);
        setNewDate("");
        setDateError(null);
        setRescheduleError(null);
        fetchCandidates();
      } else {
        setRescheduleError(res.error || "Failed to reschedule interview. Please try again.");
      }
    } catch {
      setRescheduleError("An unexpected error occurred while rescheduling.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-2">
            <Calendar className="w-4 h-4" /> Timeline
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">
            Interview Schedules
          </h1>
          <p className="text-slate-400 text-lg max-w-xl">
            View upcoming sessions and past screening intelligence.
          </p>
        </motion.div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {candidates.map((candidate, i) => (
          <motion.div
            key={candidate.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="bg-[#0a0a0f] border-slate-800/60 rounded-3xl p-6 ring-1 ring-white/5 group hover:border-indigo-500/30 transition-all flex flex-col md:flex-row items-center gap-8">
              <div className="flex flex-col items-center justify-center p-4 bg-white/[0.02] rounded-2xl min-w-[100px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  {new Date(candidate.scheduledAt || candidate.createdAt).toLocaleDateString(undefined, { month: 'short' })}
                </span>
                <span className="text-3xl font-black text-white">
                  {new Date(candidate.scheduledAt || candidate.createdAt).getDate()}
                </span>
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                {(() => {
                   const now = new Date();
                   const scheduledTime = candidate.scheduledAt ? new Date(candidate.scheduledAt) : null;
                   const isMissed = scheduledTime && scheduledTime < now && candidate.status !== 'Completed';
                   const isCompleted = candidate.status === 'Completed';

                   if (isCompleted) return (
                     <Badge className="bg-emerald-500/10 text-emerald-400 border-none px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                       <CheckCircle2 className="w-3 h-3" /> Completed
                     </Badge>
                   );
                   if (isMissed) return (
                     <Badge className="bg-red-500/10 text-red-400 border-none px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                       <AlertCircle className="w-3 h-3" /> Missed
                     </Badge>
                   );
                   return (
                     <Badge className="bg-indigo-500/10 text-indigo-400 border-none px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                       <CalendarClock className="w-3 h-3" /> Scheduled
                     </Badge>
                   );
                 })()}
                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Screening: {candidate.name}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                   <div className="flex items-center gap-1.5">
                     <Clock className="w-3.5 h-3.5" /> 
                     {candidate.scheduledAt ? new Date(candidate.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD"}
                   </div>
                   <div className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Sarah AI Room</div>
                   <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {candidate.jobTitle || "General Role"}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {(() => {
                  const now = new Date();
                  const scheduledTime = candidate.scheduledAt ? new Date(candidate.scheduledAt) : null;
                  const isMissed = scheduledTime && scheduledTime < now && candidate.status !== 'Completed';
                  const isCompleted = candidate.status === 'Completed';

                  if (isCompleted) return (
                    <Button
                      size="sm"
                      onClick={() => router.push(`/interview/${candidate.id}?view=summary`)}
                      className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20"
                    >
                      See Summary
                    </Button>
                  );

                  if (isMissed) return (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReschedulingCandidate(candidate);
                          setNewDate(candidate.scheduledAt ? new Date(candidate.scheduledAt).toISOString().slice(0, 16) : "");
                        }}
                        className="h-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        disabled
                        className="h-10 px-6 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold cursor-not-allowed border border-red-500/20"
                      >
                        Missed
                      </Button>
                    </>
                  );

                  return (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReschedulingCandidate(candidate);
                          setNewDate(candidate.scheduledAt ? new Date(candidate.scheduledAt).toISOString().slice(0, 16) : "");
                        }}
                        className="h-10 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
                      >
                        Reschedule
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/interview/${candidate.id}`;
                          navigator.clipboard.writeText(url);
                          setCopiedId(candidate.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 w-32"
                      >
                        {copiedId === candidate.id ? (
                          <><Check className="w-4 h-4 mr-2" /> Copied</>
                        ) : (
                          <><LinkIcon className="w-4 h-4 mr-2" /> Copy Link</>
                        )}
                      </Button>
                    </>
                  );
                })()}
              </div>
            </Card>
          </motion.div>
        ))}

        {candidates.length === 0 && !loading && (
          <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-[2.5rem]">
             <Calendar className="w-12 h-12 text-slate-800 mx-auto mb-4" />
             <p className="text-slate-500 italic">No interviews scheduled yet. Move a candidate to start.</p>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      <Dialog open={!!reschedulingCandidate} onOpenChange={(open) => {
        if (!open) {
          setReschedulingCandidate(null);
          setDateError(null);
          setRescheduleError(null);
        }
      }}>
        <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[425px] rounded-[2rem] p-8 ring-1 ring-white/5 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Reschedule Interview</DialogTitle>
            <DialogDescription className="text-slate-400">
              Pick a new date and time for {reschedulingCandidate?.name}.
            </DialogDescription>
          </DialogHeader>

          {rescheduleError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-2 text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{rescheduleError}</p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newDate" className="text-xs font-bold text-slate-500 uppercase tracking-widest">New Date & Time *</Label>
              <Input 
                id="newDate" 
                type="datetime-local"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  if (dateError) setDateError(null);
                }}
                className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 text-slate-200 [color-scheme:dark] ${
                  dateError ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                }`}
              />
              {dateError && (
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-1">{dateError}</p>
              )}
            </div>
          </div>
          <DialogFooter className="flex gap-3">
            <Button variant="ghost" onClick={() => setReschedulingCandidate(null)} className="flex-1 h-12 rounded-xl text-slate-400 font-bold hover:bg-white/5">
              Cancel
            </Button>
            <Button onClick={handleReschedule} disabled={isUpdating} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20">
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
