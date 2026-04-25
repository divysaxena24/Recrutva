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
import { Loader2, Edit2 } from "lucide-react";
import { useState, useEffect } from "react";
import { updateCandidate } from "@/app/actions/candidate";
import { getJobs } from "@/app/actions/job";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  targetJobId: z.string().min(1, "Please link this candidate to a job opening"),
  scheduledAt: z.string().min(1, "Please select an interview date"),
});

type FormValues = z.infer<typeof formSchema>;

interface EditCandidateModalProps {
  candidate: any;
  onSuccess?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCandidateModal({ candidate, onSuccess, open, onOpenChange }: EditCandidateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  const selectedJobId = watch("targetJobId");

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
    setIsSubmitting(true);
    try {
      const result = await updateCandidate(candidate.id, {
        ...data,
        targetJobId: data.targetJobId ? parseInt(data.targetJobId) : undefined,
      });

      if (result.success) {
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        alert("Failed to update candidate");
      }
    } catch (error) {
      console.error("Error updating candidate:", error);
      alert("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[550px] rounded-[2.5rem] p-0 overflow-hidden ring-1 ring-white/5 shadow-2xl">
        <div className="p-8 space-y-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Edit Candidate</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update details for {candidate?.name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Full Name</Label>
                <Input 
                  id="name" 
                  {...register("name")}
                  className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30"
                />
                {errors.name && <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Phone Number</Label>
                <Input 
                  id="phone" 
                  {...register("phone")}
                  className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30"
                />
                {errors.phone && <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                {...register("email")}
                className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30"
              />
              {errors.email && <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetJobId" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Linked Job Role</Label>
                <select 
                  id="targetJobId"
                  {...register("targetJobId")}
                  className="w-full bg-slate-950 border border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 text-slate-200 px-4 appearance-none outline-none transition-all"
                >
                  <option value="">-- Select a Job Opening --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id.toString()}>{job.title} (#{job.id.toString().padStart(4, '0')})</option>
                  ))}
                </select>
                {errors.targetJobId && <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">{errors.targetJobId.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Interview Date & Time</Label>
              <Input 
                id="scheduledAt" 
                type="datetime-local"
                {...register("scheduledAt")}
                className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 text-slate-200 [color-scheme:dark]"
              />
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 h-12 rounded-xl text-slate-400 hover:bg-white/5 font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
