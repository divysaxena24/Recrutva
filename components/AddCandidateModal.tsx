"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Upload, X, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createCandidate } from "@/app/actions/candidate";
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
    .refine((val) => !isNaN(Date.parse(val)), "Please select a valid date and time")
    .refine((val) => {
      const date = new Date(val);
      // Allow scheduledAt within the last 15 mins (for current time buffer) or future
      return date.getTime() >= Date.now() - 15 * 60 * 1000;
    }, "Interview date must be in the future"),
});

type FormValues = z.infer<typeof formSchema>;

/** A job row as returned by the getJobs server action. */
type Job = Awaited<ReturnType<typeof getJobs>>[number];

interface AddCandidateModalProps {
  onSuccess?: () => void;
}

export default function AddCandidateModal({ onSuccess }: AddCandidateModalProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Job[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      getJobs().then(setJobs);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(selected.type) && !selected.name.match(/\.(pdf|doc|docx)$/i)) {
        setFileError("Only PDF, DOC, and DOCX files are allowed.");
        setFile(null);
        return;
      }
      if (selected.size > 10 * 1024 * 1024) {
        setFileError("File size cannot exceed 10MB.");
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!file) {
      setFileError("Please upload a resume document.");
      return;
    }
    
    setIsSubmitting(true);
    setServerError(null);
    setFileError(null);
    
    try {
      // 1. Upload resume to Cloudinary via our API
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch("/api/upload/resume", {
        method: "POST",
        body: formData,
      });
      
      const uploadData = await uploadRes.json();
      
      if (!uploadRes.ok) {
        setServerError(uploadData.error || "Resume upload failed. Please try again.");
        setIsSubmitting(false);
        return;
      }
      
      // 2. Create candidate with real resume data
      const result = await createCandidate({
        ...data,
        targetJobId: data.targetJobId ? parseInt(data.targetJobId) : undefined,
        resumeText: uploadData.resumeText,
        resumeUrl: uploadData.resumeUrl,
        resumeFileName: uploadData.resumeFileName,
        resumePublicId: uploadData.resumePublicId,
      });

      if (result.success) {
        setOpen(false);
        reset();
        setFile(null);
        if (onSuccess) onSuccess();
      } else {
        setServerError(result.error || "Failed to create candidate.");
      }
    } catch (error) {
      console.error("Error creating candidate:", error);
      setServerError("An unexpected error occurred while importing candidate.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) {
        reset();
        setFile(null);
        setFileError(null);
        setServerError(null);
      }
    }}>
      <DialogTrigger render={
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 h-12 font-bold shadow-lg shadow-indigo-500/20 group">
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
          Add Candidate
        </Button>
      } />
      <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[550px] rounded-[2.5rem] p-0 overflow-hidden ring-1 ring-white/5 shadow-2xl">
        <div className="p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">Add New Candidate</DialogTitle>
            <DialogDescription className="text-slate-400">
              Import candidate details and upload their resume for AI matching.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3 text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Full Name *</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Divya Saxena" 
                  {...register("name")}
                  className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 ${
                    errors.name ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                  }`}
                />
                {errors.name && <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Phone Number *</Label>
                <Input 
                  id="phone" 
                  placeholder="7024296567" 
                  {...register("phone")}
                  className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 ${
                    errors.phone ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                  }`}
                />
                {errors.phone && <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Address *</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="divysaxena2402@gmail.com" 
                {...register("email")}
                className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 ${
                  errors.email ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                }`}
              />
              {errors.email && <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resume Document *</Label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer group
                  ${fileError ? 'border-rose-500/50 bg-rose-500/5' : file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5'}
                `}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept=".pdf,.doc,.docx"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-bold text-white">{file.name}</span>
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-[10px] text-slate-500 hover:text-rose-400 font-bold uppercase flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove File
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/20 transition-all mb-2">
                      <Upload className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">Click to upload or drag & drop</p>
                    <p className="text-[10px] text-slate-600 font-medium uppercase mt-1">PDF, DOC, DOCX up to 10MB</p>
                  </>
                )}
              </div>
              {fileError && <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-1">{fileError}</p>}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="targetJobId" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Job Role *</Label>
                <select 
                  id="targetJobId"
                  {...register("targetJobId")}
                  className={`w-full bg-slate-950 border border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 text-slate-200 px-4 appearance-none outline-none transition-all ${
                    errors.targetJobId ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                  }`}
                >
                  <option value="">-- Select a Job Opening --</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id.toString()}>{job.title} (#{job.id.toString().padStart(4, '0')})</option>
                  ))}
                </select>
                {errors.targetJobId && <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-1">{errors.targetJobId.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduledAt" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Schedule Interview Date & Time *</Label>
              <Input 
                id="scheduledAt" 
                type="datetime-local"
                {...register("scheduledAt")}
                className={`bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30 text-slate-200 [color-scheme:dark] ${
                  errors.scheduledAt ? "border-rose-500/50 focus:ring-rose-500/30" : ""
                }`}
              />
              {errors.scheduledAt && <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider mt-1">{errors.scheduledAt.message}</p>}
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-12 rounded-xl text-slate-400 hover:bg-white/5 font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Import Candidate"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
