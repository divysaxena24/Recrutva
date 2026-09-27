"use client";

import { motion } from "framer-motion";
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Link as LinkIcon,
  Check,
  XCircle,
  History,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getRecruiterSchedulesAction,
  rescheduleCandidate,
  cancelScheduleAction,
} from "@/app/actions/candidate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

type ScheduleItem = Awaited<ReturnType<typeof getRecruiterSchedulesAction>>[number];

export default function SchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"ALL" | "UPCOMING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "MISSED">("ALL");

  // Reschedule state
  const [reschedulingSchedule, setReschedulingSchedule] = useState<ScheduleItem | null>(null);
  const [newDate, setNewDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Cancellation state
  const [cancellingSchedule, setCancellingSchedule] = useState<ScheduleItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // History inspection modal
  const [inspectingSchedule, setInspectingSchedule] = useState<ScheduleItem | null>(null);

  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchSchedulesData = useCallback(() => {
    getRecruiterSchedulesAction()
      .then((data) => {
        setSchedules(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchSchedulesData();
  }, [fetchSchedulesData]);

  const handleReschedule = async () => {
    if (!reschedulingSchedule) return;

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
      const res = await rescheduleCandidate(
        reschedulingSchedule.candidateId,
        newDate,
        rescheduleReason || "Rescheduled via recruiter schedule management"
      );
      if (res.success) {
        setReschedulingSchedule(null);
        setNewDate("");
        setRescheduleReason("");
        setDateError(null);
        setRescheduleError(null);
        fetchSchedulesData();
      } else {
        setRescheduleError(res.error || "Failed to reschedule interview. Conflict detected.");
      }
    } catch {
      setRescheduleError("An unexpected error occurred while rescheduling.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!cancellingSchedule) return;

    setIsCancelling(true);
    try {
      const res = await cancelScheduleAction(
        cancellingSchedule.id,
        cancelReason || "Cancelled by recruiter"
      );
      if (res.success) {
        setCancellingSchedule(null);
        setCancelReason("");
        fetchSchedulesData();
      } else {
        alert(res.error || "Failed to cancel schedule");
      }
    } catch {
      alert("Error occurred while cancelling schedule.");
    } finally {
      setIsCancelling(false);
    }
  };

  const filteredSchedules = schedules.filter((s) => {
    const now = new Date();
    const scheduledTime = new Date(s.scheduledAt);

    if (filterTab === "UPCOMING") {
      return (s.status === "SCHEDULED" || s.status === "CONFIRMED" || s.status === "RESCHEDULED") && scheduledTime >= now;
    }
    if (filterTab === "CONFIRMED") return s.status === "CONFIRMED";
    if (filterTab === "COMPLETED") return s.status === "COMPLETED";
    if (filterTab === "CANCELLED") return s.status === "CANCELLED";
    if (filterTab === "MISSED") return s.status === "MISSED" || (scheduledTime < now && s.status !== "COMPLETED" && s.status !== "CANCELLED");
    return true;
  });

  return (
    <div className="space-y-8 pb-16">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-1.5">
            <Calendar className="w-4 h-4" /> Timeline & Conflict Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Interview Schedules
          </h1>
          <p className="text-slate-600 text-base max-w-xl">
            Production schedule management with conflict detection, audit history, and access window controls.
          </p>
        </motion.div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200">
          {(["ALL", "UPCOMING", "CONFIRMED", "COMPLETED", "CANCELLED", "MISSED"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterTab === tab
                  ? "bg-white text-indigo-600 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6">
        {filteredSchedules.map((schedule, i) => {
          const now = new Date();
          const scheduledTime = new Date(schedule.scheduledAt);
          const isMissed = (scheduledTime < now && schedule.status !== "COMPLETED" && schedule.status !== "CANCELLED") || schedule.status === "MISSED";

          return (
            <motion.div
              key={schedule.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="bg-white border-slate-200/80 rounded-3xl p-6 shadow-xs group hover:border-indigo-300 hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-6">
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-2xl min-w-[110px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    {scheduledTime.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                  <span className="text-3xl font-black text-slate-900">
                    {scheduledTime.getDate()}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                    {scheduledTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {schedule.status === "COMPLETED" && (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </Badge>
                    )}
                    {schedule.status === "CONFIRMED" && (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> Candidate Confirmed
                      </Badge>
                    )}
                    {schedule.status === "RESCHEDULED" && (
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Rescheduled
                      </Badge>
                    )}
                    {schedule.status === "SCHEDULED" && !isMissed && (
                      <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Scheduled
                      </Badge>
                    )}
                    {schedule.status === "CANCELLED" && (
                      <Badge className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Cancelled
                      </Badge>
                    )}
                    {isMissed && schedule.status !== "CANCELLED" && (
                      <Badge className="bg-rose-50 text-rose-700 border border-rose-200 px-3 py-0.5 rounded-lg text-[9px] font-bold uppercase flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Missed
                      </Badge>
                    )}

                    <span className="text-xs font-bold text-slate-400">•</span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">
                      {schedule.roundName || schedule.roundType || "Recrutva AI Interview"}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {schedule.candidateName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {schedule.durationMinutes} mins
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400" />
                      {schedule.timezone}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {schedule.jobTitle || schedule.linkedJobTitle || "General Role"}
                    </div>
                    {schedule.logs.length > 0 && (
                      <button
                        onClick={() => setInspectingSchedule(schedule)}
                        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 font-bold underline decoration-slate-300"
                      >
                        <History className="w-3 h-3" /> {schedule.logs.length} History Logs
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {schedule.status === "COMPLETED" ? (
                    <Button
                      size="sm"
                      onClick={() => router.push(`/interview/${schedule.candidateId}?view=summary`)}
                      className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                    >
                      See Summary
                    </Button>
                  ) : schedule.status === "CANCELLED" ? (
                    <span className="text-xs font-bold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
                      Cancelled
                    </span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReschedulingSchedule(schedule);
                          setNewDate(new Date(schedule.scheduledAt).toISOString().slice(0, 16));
                        }}
                        className="h-10 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
                      >
                        Reschedule
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCancellingSchedule(schedule)}
                        className="h-10 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-semibold"
                      >
                        Cancel
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => {
                          const url = schedule.meetingUrl || `${window.location.origin}/interview/${schedule.candidateId}`;
                          navigator.clipboard.writeText(url);
                          setCopiedId(schedule.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs min-w-[110px]"
                      >
                        {copiedId === schedule.id ? (
                          <><Check className="w-4 h-4 mr-1.5" /> Copied</>
                        ) : (
                          <><LinkIcon className="w-4 h-4 mr-1.5" /> Copy Link</>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}

        {filteredSchedules.length === 0 && !loading && (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium text-sm">No interview schedules found in this filter.</p>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      <Dialog
        open={!!reschedulingSchedule}
        onOpenChange={(open) => {
          if (!open) {
            setReschedulingSchedule(null);
            setDateError(null);
            setRescheduleError(null);
          }
        }}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[450px] rounded-3xl p-8 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Reschedule Interview</DialogTitle>
            <DialogDescription className="text-slate-500">
              Update date & time for {reschedulingSchedule?.candidateName}. Conflict detection will run automatically.
            </DialogDescription>
          </DialogHeader>

          {rescheduleError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <p>{rescheduleError}</p>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="newDate" className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                New Date & Time *
              </Label>
              <Input
                id="newDate"
                type="datetime-local"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  if (dateError) setDateError(null);
                }}
                className={`bg-white border-slate-200 h-12 rounded-xl text-slate-900 [color-scheme:light] ${
                  dateError ? "border-rose-500" : ""
                }`}
              />
              {dateError && <p className="text-[10px] font-bold text-rose-600 uppercase mt-1">{dateError}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Reason for Rescheduling
              </Label>
              <Input
                id="reason"
                placeholder="e.g. Recruiter availability conflict"
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                className="bg-white border-slate-200 h-12 rounded-xl text-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setReschedulingSchedule(null)}
              className="flex-1 h-12 rounded-xl text-slate-600 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReschedule}
              disabled={isUpdating}
              className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Modal */}
      <Dialog
        open={!!cancellingSchedule}
        onOpenChange={(open) => {
          if (!open) setCancellingSchedule(null);
        }}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[425px] rounded-3xl p-8 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Cancel Interview</DialogTitle>
            <DialogDescription className="text-slate-500">
              Are you sure you want to cancel the interview for {cancellingSchedule?.candidateName}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cancelReason" className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Cancellation Reason
              </Label>
              <Input
                id="cancelReason"
                placeholder="e.g. Candidate withdrew application"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="bg-white border-slate-200 h-12 rounded-xl text-slate-900"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="ghost"
              onClick={() => setCancellingSchedule(null)}
              className="flex-1 h-12 rounded-xl text-slate-600 font-bold"
            >
              Keep Schedule
            </Button>
            <Button
              onClick={handleCancelSchedule}
              disabled={isCancelling}
              className="flex-1 h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cancel Interview"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit History Modal */}
      <Dialog
        open={!!inspectingSchedule}
        onOpenChange={(open) => {
          if (!open) setInspectingSchedule(null);
        }}
      >
        <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[500px] rounded-3xl p-8 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" /> Schedule Audit Trail
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              History for candidate {inspectingSchedule?.candidateName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[300px] overflow-y-auto pr-2">
            {inspectingSchedule?.logs.map((log: Record<string, unknown>, idx: number) => (
              <div key={String(log.id || idx)} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span className="uppercase text-[10px] tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {String(log.action)}
                  </span>
                  <span className="text-slate-400 font-normal text-[10px]">
                    {new Date(log.createdAt as string | Date).toLocaleString()}
                  </span>
                </div>
                {Boolean(log.newScheduledAt) && (
                  <p className="text-slate-600 font-medium">
                    Scheduled For: {new Date(log.newScheduledAt as string | Date).toLocaleString()}
                  </p>
                )}
                {Boolean(log.reason) && <p className="text-slate-500 italic">&quot;{String(log.reason)}&quot;</p>}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setInspectingSchedule(null)}
              className="w-full h-11 rounded-xl bg-slate-900 text-white font-bold"
            >
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
