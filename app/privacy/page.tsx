"use client";

import Link from "next/link";
import { ArrowLeft, Bot, ShieldCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PrivacyPage() {
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
          <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
            <Lock className="w-3.5 h-3.5 mr-1 text-emerald-600 inline" /> Data Security & Protection
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-slate-500 text-sm font-medium">Last updated: September 25, 2026</p>
        </div>

        {/* Content Document */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-12 shadow-xs space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" /> 1. Information We Collect
            </h2>
            <p>
              At Recrutva, we respect your privacy and process data solely to provide automated hiring and assessment services. Information collected includes:
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-600">
              <li>Candidate profile details (Name, email address, phone number, work history).</li>
              <li>Resume files uploaded via PDF/DOCX format.</li>
              <li>Evaluation data generated during technical assessments and AI interviews.</li>
              <li>Recruiter job descriptions and custom hiring pipeline preferences.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" /> 2. How We Use Data & AI Models
            </h2>
            <p>
              Your data is processed using high-performance Groq API LLM infrastructure strictly to perform ATS resume parsing, compute candidate-role match scores, and evaluate technical interview responses. We do not sell user data to third-party data brokers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" /> 3. Data Storage & Cloud Security
            </h2>
            <p>
              Resumes and candidate attachments are securely stored using Cloudinary cloud storage infrastructure with SSL/TLS encryption in transit and at rest. Authentication is secured by Clerk identity systems.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" /> 4. Your Data Control Rights
            </h2>
            <p>
              Candidates and recruiters may request data deletion or update submitted resume records at any time by contacting our support team or deleting job postings from the dashboard.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" /> 5. Privacy Inquiries
            </h2>
            <p>
              For privacy requests or questions regarding data processing, email founder Divya Saxena at{" "}
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
