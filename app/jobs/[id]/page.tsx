"use client";

import { motion } from "framer-motion";
import { Briefcase, MapPin, Calendar, Clock, Sparkles, ArrowRight, ShieldCheck, Upload, CheckCircle2, X, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useRef } from "react";
import { getJobById } from "@/app/actions/job";
import { createCandidate } from "@/app/actions/candidate";
import { checkExistingApplication } from "@/app/actions/check-application";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function JobApplyPage() {
  const router = useRouter();
  const params = useParams();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState<any>(null);
  const [error, setError] = useState("");
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.id) {
      const jobId = parseInt(params.id as string);
      getJobById(jobId).then(data => {
        setJob(data);
        setLoading(false);
      });

      checkExistingApplication(jobId).then(app => {
        if (app) setAlreadyApplied(app);
      });
    }
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Please upload your resume");
    
    setSubmitting(true);
    try {
      const resumeText = `Public application for ${job?.title}. Candidate ${name} uploaded ${file.name}.`;
      
      const res = await createCandidate({
        name,
        email,
        phone,
        resumeText,
        targetJobId: job.id,
        // For public apps, we set a default schedule or leave it for recruiter
        scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Default: Tomorrow
      });

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "Application failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please check your details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="w-10 h-10 text-indigo-500 animate-spin" /></div>;
  if (!job) return <div className="h-screen bg-[#050505] flex items-center justify-center text-white font-bold text-2xl px-6 text-center">Job Postings Not Found or Expired.</div>;

  if (success) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-50 flex items-center justify-center p-6">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full text-center space-y-8">
           <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-500/10 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
           </div>
           <div className="space-y-3">
             <h2 className="text-3xl font-black">Application Sent!</h2>
             <p className="text-slate-400">Thank you for applying, {name.split(' ')[0]}. Our AI system will review your profile shortly. Keep an eye on your email for the interview invitation.</p>
           </div>
           <Link href="/jobs" className="block">
             <Button className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold">Back to Job Board</Button>
           </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-50 font-sans pb-20">
      <nav className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-50">
        <Link href="/jobs" className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/20">
            <Briefcase className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="font-bold text-xl tracking-tight">Recrutva <span className="text-indigo-500">Careers</span></span>
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-8">
        <button 
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-white transition-colors group cursor-pointer"
        >
          <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-bold uppercase tracking-widest">Back</span>
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 pt-16">
        {/* Left: Job Details */}
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="space-y-10">
          <div className="space-y-6">
             <Badge className="bg-indigo-500/10 text-indigo-400 border-none px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest">{job.location}</Badge>
             <h1 className="text-5xl font-black text-white leading-tight">{job.title}</h1>
             <div className="flex items-center gap-6 text-slate-500 font-bold uppercase text-[11px] tracking-widest">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-400" /> Full-time</div>
                <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-indigo-400" /> {job.location}</div>
             </div>
          </div>

          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400" /> About the Role
              </h3>
              <p className="text-slate-400 leading-relaxed text-lg">{job.description}</p>
            </section>

            {job.requirements && (
              <section className="space-y-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" /> Requirements
                </h3>
                <div className="space-y-3">
                  {job.requirements.split('\n').map((req: string, i: number) => (
                    <div key={i} className="flex gap-3 text-slate-400">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <Card className="p-6 bg-indigo-600/10 border-indigo-500/20 rounded-[2rem] ring-1 ring-indigo-500/20">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                   <h4 className="font-bold text-white">AI-Powered Application</h4>
                   <p className="text-xs text-indigo-200/70">Sarah, our AI Recruiter, will review your resume and guide your screening interview.</p>
                </div>
             </div>
          </Card>
        </motion.div>

        {/* Right: Application Form */}
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-[#0a0a0f] border-slate-800/60 rounded-[3rem] p-10 ring-1 ring-white/5 shadow-2xl sticky top-32">
            {alreadyApplied ? (
              <div className="space-y-8 text-center py-10">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-bold text-white">Application Received</h2>
                  <p className="text-sm text-slate-400">You have already applied for this position on {new Date(alreadyApplied.createdAt).toLocaleDateString()}. Check your dashboard for updates.</p>
                </div>
                <Link href="/candidate-dashboard" className="block">
                  <Button className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold ring-1 ring-white/10 transition-all">Go to Dashboard</Button>
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold text-white mb-8">Apply for this position</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                      <X className="w-4 h-4 shrink-0" />
                      <p className="font-medium">{error}</p>
                    </div>
                  )}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Cooper" className="h-14 bg-slate-950 border-slate-800 rounded-2xl pl-5" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className="h-14 bg-slate-950 border-slate-800 rounded-2xl pl-5" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Phone Number</Label>
                <Input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" className="h-14 bg-slate-950 border-slate-800 rounded-2xl pl-5" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Resume / CV</Label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer ${file ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 hover:border-indigo-500/40 hover:bg-indigo-500/5'}`}
                >
                  <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && setFile(e.target.files[0])} className="hidden" accept=".pdf,.doc,.docx" />
                  {file ? (
                    <div className="text-center">
                       <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                       <p className="text-sm font-bold text-white">{file.name}</p>
                       <p className="text-[10px] text-slate-500 uppercase mt-2">Ready to upload</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-sm font-bold text-slate-400">Upload PDF or DOC</p>
                      <p className="text-[10px] text-slate-600 uppercase mt-2">Max size 10MB</p>
                    </>
                  )}
                </div>
              </div>

                <div className="pt-6">
                  <Button type="submit" disabled={submitting} className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-lg shadow-2xl shadow-indigo-500/30">
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Submit Application"}
                  </Button>
                  <p className="text-center text-[10px] text-slate-600 font-bold uppercase mt-6 tracking-widest">By applying, you agree to our terms & privacy policy</p>
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
