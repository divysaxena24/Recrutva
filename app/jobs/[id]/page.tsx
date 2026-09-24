"use client";

import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, Sparkles, ArrowRight, ShieldCheck, Upload, CheckCircle2, Loader2, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getJobById } from "@/app/actions/job";
import { createCandidate } from "@/app/actions/candidate";
import { checkExistingApplication } from "@/app/actions/check-application";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const phoneRegex = /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;

const jobApplySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
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
});

type JobApplyFormValues = z.infer<typeof jobApplySchema>;

/** A job as returned by the getJobById server action (null when missing). */
type JobDetail = NonNullable<Awaited<ReturnType<typeof getJobById>>>;

/** An existing application row as returned by checkExistingApplication. */
type ExistingApplication = Awaited<ReturnType<typeof checkExistingApplication>>;

export default function JobApplyPage() {
  const router = useRouter();
  const params = useParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState<ExistingApplication>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<JobApplyFormValues>({
    resolver: zodResolver(jobApplySchema),
  });

  useEffect(() => {
    if (params.id) {
      const jobId = parseInt(params.id as string);
      getJobById(jobId).then(data => {
        // Unpublished drafts are not candidate-facing: a draft id should
        // behave the same as a missing job on this public route.
        setJob(data && data.status !== "DRAFT" ? data : null);
        setLoading(false);
      });

      checkExistingApplication(jobId).then(app => {
        if (app) setAlreadyApplied(app);
      });
    }
  }, [params.id]);

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

  const onSubmit = async (data: JobApplyFormValues) => {
    if (!job) return;
    if (!file) {
      setFileError("Please upload your resume document.");
      return;
    }
    
    setSubmitting(true);
    setError("");
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
        setError(uploadData.error || "Resume upload failed. Please try again.");
        setSubmitting(false);
        return;
      }
      
      // 2. Create candidate with real resume data
      const res = await createCandidate({
        name: data.name,
        email: data.email,
        phone: data.phone,
        resumeText: uploadData.resumeText,
        resumeUrl: uploadData.resumeUrl,
        resumeFileName: uploadData.resumeFileName,
        resumePublicId: uploadData.resumePublicId,
        targetJobId: job.id,
      });

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "Application submission failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>;
  if (!job) return <div className="h-screen bg-slate-50 flex items-center justify-center text-slate-900 font-bold text-2xl px-6 text-center">Job Postings Not Found or Expired.</div>;

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center space-y-8 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs">
           <div className="w-20 h-20 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
           </div>
           <div className="space-y-3">
             <h2 className="text-3xl font-black text-slate-900">Application Sent!</h2>
             <p className="text-slate-600 text-sm">Thank you for applying! Our AI system will review your profile shortly. Keep an eye on your email for the interview invitation.</p>
           </div>
           <Link href="/jobs" className="block">
             <Button className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-xs">Back to Job Board</Button>
           </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <nav className="h-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-50">
        <Link href="/jobs" className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-xl ring-1 ring-indigo-100">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">Recrutva <span className="text-indigo-600">Careers</span></span>
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-8">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 pt-10">
        {/* Left: Job Details */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
          <div className="space-y-4">
             <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">{job.location}</Badge>
             <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">{job.title}</h1>
             <div className="flex items-center gap-6 text-slate-500 font-bold uppercase text-[11px] tracking-widest">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-600" /> Full-time</div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-600" /> {job.location}</div>
             </div>
          </div>

          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600" /> About the Role
              </h3>
              <p className="text-slate-600 leading-relaxed text-base">{job.description}</p>
            </section>

            {job.requirements && (
              <section className="space-y-3">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" /> Requirements
                </h3>
                <div className="space-y-2.5">
                  {job.requirements.split('\n').map((req: string, i: number) => (
                    <div key={i} className="flex gap-3 text-slate-600 text-base">
                      <span className="text-indigo-600 font-bold">•</span>
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <Card className="p-6 bg-indigo-50 border-indigo-200 rounded-3xl shadow-xs">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Bot className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                   <h4 className="font-bold text-slate-900">AI-Powered Application</h4>
                   <p className="text-xs text-indigo-900/80 mt-0.5">Sarah, our AI Recruiter, will review your resume and guide your screening interview.</p>
                </div>
             </div>
          </Card>
        </motion.div>

        {/* Right: Application Form */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-white border-slate-200/80 rounded-3xl p-8 lg:p-10 shadow-xs sticky top-32">
            {alreadyApplied ? (
              <div className="space-y-6 text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-slate-900">Application Received</h2>
                  <p className="text-sm text-slate-600">You have already applied for this position on {new Date(alreadyApplied.createdAt).toLocaleDateString()}. Check your dashboard for updates.</p>
                </div>
                <Link href="/candidate-dashboard" className="block">
                  <Button className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs">Go to Dashboard</Button>
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Apply for this position</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {error && (
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <p className="font-medium">{error}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Full Name *</Label>
                    <Input 
                      placeholder="Jane Cooper" 
                      {...register("name")}
                      className={`h-12 bg-white border-slate-200 text-slate-900 rounded-xl pl-4 focus:ring-indigo-500/20 ${
                        errors.name ? "border-rose-500 focus:ring-rose-500/20" : ""
                      }`}
                    />
                    {errors.name && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider ml-1 mt-1">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Email Address *</Label>
                    <Input 
                      type="email" 
                      placeholder="jane@example.com" 
                      {...register("email")}
                      className={`h-12 bg-white border-slate-200 text-slate-900 rounded-xl pl-4 focus:ring-indigo-500/20 ${
                        errors.email ? "border-rose-500 focus:ring-rose-500/20" : ""
                      }`}
                    />
                    {errors.email && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider ml-1 mt-1">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Phone Number *</Label>
                    <Input 
                      placeholder="+1 (555) 000-0000" 
                      {...register("phone")}
                      className={`h-12 bg-white border-slate-200 text-slate-900 rounded-xl pl-4 focus:ring-indigo-500/20 ${
                        errors.phone ? "border-rose-500 focus:ring-rose-500/20" : ""
                      }`}
                    />
                    {errors.phone && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider ml-1 mt-1">{errors.phone.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Resume / CV *</Label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all cursor-pointer ${
                        fileError ? 'border-rose-300 bg-rose-50/50' : file ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange} 
                        className="hidden" 
                        accept=".pdf,.doc,.docx" 
                      />
                      {file ? (
                        <div className="text-center">
                           <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                           <p className="text-sm font-bold text-slate-900">{file.name}</p>
                           <p className="text-[10px] text-slate-500 uppercase mt-1 font-bold">Ready to upload</p>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-7 h-7 text-slate-400 mb-2" />
                          <p className="text-sm font-bold text-slate-700">Upload PDF, DOC, or DOCX</p>
                          <p className="text-[10px] text-slate-400 uppercase mt-1 font-bold">Max size 10MB</p>
                        </>
                      )}
                    </div>
                    {fileError && <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider ml-1 mt-1">{fileError}</p>}
                  </div>

                  <div className="pt-4">
                    <Button type="submit" disabled={submitting} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-xs">
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Application"}
                    </Button>
                    <p className="text-center text-[10px] text-slate-400 font-bold uppercase mt-4 tracking-widest">By applying, you agree to our terms & privacy policy</p>
                  </div>
                </form>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
