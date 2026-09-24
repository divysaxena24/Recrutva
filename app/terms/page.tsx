"use client";

import Link from "next/link";
import { ArrowLeft, Bot, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">Recrutva</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="rounded-full gap-2 text-slate-600 font-bold hover:bg-slate-100">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Title */}
        <div className="space-y-4 text-center sm:text-left">
          <Badge variant="outline" className="bg-indigo-50 border-indigo-200 text-indigo-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-indigo-600 inline" /> Legal & Governance
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">Terms of Service</h1>
          <p className="text-slate-500 text-sm font-medium">Last updated: September 25, 2026</p>
        </div>

        {/* Content Document */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-xs space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> 1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Recrutva (&quot;the Platform&quot;), including our AI automated hiring pipeline, AI voice/video interview systems, and recruiter dashboards, you agree to be bound by these Terms of Service. If you do not agree to these terms, please refrain from using the Platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> 2. Description of Service
            </h2>
            <p>
              Recrutva provides recruiters and job candidates with AI-driven talent acquisition and evaluation tools powered by Groq API models. Services include automated resume ATS scoring, interactive technical assessments, AI interview evaluations, and multi-stage candidate pipeline management.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> 3. User Accounts & Responsibilities
            </h2>
            <ul className="space-y-2 list-disc list-inside text-slate-600">
              <li>Users must provide accurate registration details via our Clerk authentication system.</li>
              <li>Recruiters are responsible for maintaining non-discriminatory hiring standards and complying with local labor laws.</li>
              <li>Candidates must submit genuine resume information and complete assessments without unauthorized automated assistance.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> 4. AI Automated Evaluation Disclaimer
            </h2>
            <p>
              Recrutva utilizes Groq-powered AI algorithms to assist in resume match scoring and candidate assessment evaluations. Recrutva serves as an analytical assistant; final hiring decisions remain the sole responsibility of the hiring organization and recruiter.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> 5. Intellectual Property & Data Rights
            </h2>
            <p>
              All proprietary algorithms, UI components, brand assets, and platform code are owned by Recrutva and creator Divya Saxena. User-submitted resumes and job description data remain the property of the respective candidate and recruiter.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> 6. Contact & Inquiries
            </h2>
            <p>
              For questions regarding these Terms, contact founder Divya Saxena at{" "}
              <a href="mailto:divysaxena2402@gmail.com" className="text-indigo-600 font-bold hover:underline">
                divysaxena2402@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
