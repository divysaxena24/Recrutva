"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Sparkles, Loader2, Briefcase, MapPin, AlertCircle } from "lucide-react";
import { createJob } from "@/app/actions/job";

const addJobSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Job title must be at least 3 characters")
    .max(100, "Job title cannot exceed 100 characters"),
  location: z
    .string()
    .trim()
    .min(2, "Location must be at least 2 characters")
    .max(100, "Location cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Job description must be at least 10 characters")
    .max(5000, "Job description cannot exceed 5000 characters"),
  requirements: z
    .string()
    .trim()
    .max(2000, "Requirements cannot exceed 2000 characters")
    .optional()
    .or(z.literal("")),
});

type AddJobFormValues = z.infer<typeof addJobSchema>;

export default function AddJobModal({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<AddJobFormValues>({
    resolver: zodResolver(addJobSchema),
    defaultValues: {
      title: "",
      location: "Remote",
      description: "",
      requirements: "",
    },
  });

  const titleValue = useWatch({ control, name: "title" });

  const handleGenerateAI = async () => {
    if (!titleValue || titleValue.trim().length < 3) {
      setServerError("Please enter a valid job title (at least 3 characters) first.");
      return;
    }

    setGenerating(true);
    setServerError(null);

    try {
      const res = await fetch("/api/ai/generate-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleValue }),
      });
      const data = await res.json();
      if (data.description) {
        setValue("description", data.description, { shouldValidate: true, shouldDirty: true });
      } else if (data.error) {
        setServerError(data.error);
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
      setServerError("Failed to generate description with AI. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const onSubmit = async (data: AddJobFormValues) => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await createJob({
        title: data.title,
        location: data.location,
        description: data.description,
        requirements: data.requirements || undefined,
      });

      if (res.success) {
        setIsOpen(false);
        reset();
        onSuccess();
      } else {
        setServerError(res.error || "Failed to create job.");
      }
    } catch (error) {
      console.error("Failed to create job:", error);
      setServerError("An unexpected error occurred while posting the job.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => {
      setIsOpen(val);
      if (!val) {
        reset();
        setServerError(null);
      }
    }}>
      <DialogTrigger render={
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 h-12 font-bold shadow-lg shadow-indigo-500/20 group">
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
          Post New Role
        </Button>
      } />
      <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[600px] rounded-[2.5rem] p-0 overflow-hidden ring-1 ring-white/5">
        <div className="p-8 space-y-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/30">
                <Briefcase className="w-5 h-5 text-indigo-400" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">Post a New Opportunity</DialogTitle>
            </div>
            <p className="text-slate-400 text-sm">Fill in the details below or let our AI help you draft the perfect role.</p>
          </DialogHeader>

          {serverError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g. Senior Frontend Developer"
                  {...register("title")}
                  className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 ${
                    errors.title ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                  }`}
                />
                {errors.title && (
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-1">{errors.title.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Location *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="location"
                    placeholder="Remote, NYC, etc."
                    {...register("location")}
                    className={`bg-slate-950 border-slate-800 h-12 rounded-xl pl-10 focus:ring-indigo-500/30 ${
                      errors.location ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                    }`}
                  />
                </div>
                {errors.location && (
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-1">{errors.location.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Description *</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleGenerateAI}
                  disabled={generating || !titleValue || titleValue.trim().length < 3}
                  className="h-7 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg gap-1.5"
                >
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Generate with AI
                </Button>
              </div>
              <Textarea
                id="description"
                placeholder="Describe the role, responsibilities, and expectations..."
                {...register("description")}
                className={`bg-slate-950 border-slate-800 min-h-[150px] rounded-2xl p-4 focus:ring-indigo-500/30 resize-none ${
                  errors.description ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                }`}
              />
              {errors.description && (
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Requirements (Optional)</Label>
              <Input
                id="requirements"
                placeholder="e.g. 5+ years React, TypeScript, Node.js"
                {...register("requirements")}
                className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 ${
                  errors.requirements ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                }`}
              />
              {errors.requirements && (
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-1">{errors.requirements.message}</p>
              )}
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="flex-1 h-12 rounded-xl text-slate-400 hover:bg-white/5 font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Job Opening"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
