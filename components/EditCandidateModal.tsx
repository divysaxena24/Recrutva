"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { updateCandidate } from "@/app/actions/candidate";
import type { getCandidates } from "@/app/actions/candidate";
import { getJobs } from "@/app/actions/job";

const phoneRegex = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254, "Email is too long"),
  phone: z
    .string()
    .trim()
    .refine((val) => phoneRegex.test(val), "Please enter a valid phone number (at least 10 digits)"),
  targetJobId: z.string().min(1, "Please link this candidate to a job opening"),
  scheduledAt: z
    .string()
    .min(1, "Please select an interview date and time")
    .refine((val) => !isNaN(Date.parse(val)), "Please select a valid date and time"),
});

type FormValues = z.infer<typeof formSchema>;

/** A candidate row as returned by the getCandidates server action. */
type CandidateRow = Awaited<ReturnType<typeof getCandidates>>[number];

/** A job row as returned by the getJobs server action. */
type Job = Awaited<ReturnType<typeof getJobs>>[number];

interface EditCandidateModalProps {
  candidate: CandidateRow | null;
  onSuccess?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCandidateModal({ candidate, onSuccess, open, onOpenChange }: EditCandidateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (candidate) {
      reset({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        targetJobId: candidate.targetJobId?.toString() || "",
        scheduledAt: candidate.scheduledAt ? new Date(candidate.scheduledAt).toISOString().slice(0, 16) : "",
      });
    }
  }, [candidate, reset]);

  useEffect(() => {
    if (open) {
      getJobs().then(setJobs);
    }
  }, [open]);

  const onSubmit = async (data: FormValues) => {
    if (!candidate) return;
    setIsSubmitting(true);
    setServerError(null);

    try {
      const result = await updateCandidate(candidate.id, {
        ...data,
        targetJobId: data.targetJobId ? parseInt(data.targetJobId) : undefined,
      });

      if (result.success) {
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        setServerError(result.error || "Failed to update candidate.");
      }
    } catch (error) {
      console.error("Error updating candidate:", error);
      setServerError("An unexpected error occurred while updating candidate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setServerError(null);
    }}>
      <DialogContent className="bg-white border-slate-200 text-slate-900 sm:max-w-[550px] rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight text-slate-900">Edit Candidate</DialogTitle>
            <DialogDescription className="text-slate-500">
              Update details for {candidate?.name}.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <p>{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Full Name *</Label>
                <Input 
                  id="name" 
                  {...register("name")}
                  className={`bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                    errors.name ? "border-rose-400 focus:ring-rose-500/20" : ""
                  }`}
                />
                {errors.name && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone Number *</Label>
                <Input 
                  id="phone" 
                  {...register("phone")}
                  className={`bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                    errors.phone ? "border-rose-400 focus:ring-rose-500/20" : ""
                  }`}
                />
                {errors.phone && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email Address *</Label>
              <Input 
                id="email" 
                type="email" 
                {...register("email")}
                className={`bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 ${
                  errors.email ? "border-rose-400 focus:ring-rose-500/20" : ""
                }`}
              />
              {errors.email && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetJobId" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Linked Job Role *</Label>
                <select 
                  id="targetJobId"
                  {...register("targetJobId")}
                  className={`w-full bg-slate-50 border border-slate-200 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 text-slate-900 px-4 appearance-none outline-none transition-all ${
                    errors.targetJobId ? "border-rose-400 focus:ring-rose-500/20" : ""
                  }`}
                >
                  <option value="">-- Select a Job Opening --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id.toString()}>{job.title} (#{job.id.toString().padStart(4, '0')})</option>
                  ))}
                </select>
                {errors.targetJobId && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-1">{errors.targetJobId.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className="text-xs font-bold text-slate-600 uppercase tracking-wider">Interview Date & Time *</Label>
              <Input 
                id="scheduledAt" 
                type="datetime-local"
                {...register("scheduledAt")}
                className={`bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 [color-scheme:light] ${
                  errors.scheduledAt ? "border-rose-400 focus:ring-rose-500/20" : ""
                }`}
              />
              {errors.scheduledAt && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-1">{errors.scheduledAt.message}</p>}
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 h-12 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/20">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

