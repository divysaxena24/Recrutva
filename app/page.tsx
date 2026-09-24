"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Mic,
  Users,
  Calendar,
  Bot,
  Sparkles,
  CheckCircle2,
  Sliders,
  Layers,
  FileCheck,
  Cpu,
  Mail,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignInButton, SignUpButton, UserButton, useAuth, useClerk } from "@clerk/nextjs";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Link from "next/link";

/**
 * Decorative audio-wave bars for the mock live-call card.
 * The randomized values are computed once at module scope: Math.random() is an
 * impure function and must not run during render (react-hooks/purity).
 */
const AUDIO_WAVE_BARS = Array.from({ length: 30 }, () => ({
  height: `${Math.random() * 80 + 20}%`,
  duration: Math.random() * 0.5 + 0.5,
  delay: Math.random() * 0.2,
}));

/**
 * Post-sign-in destination. The middleware appends `?redirect=<path>` when it
 * bounces an unauthenticated visitor away from a protected route.
 */
function SafeRedirectPath({ fallback }: { fallback: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("redirect") ?? "";
  const safe = requested.startsWith("/") && !requested.startsWith("//") ? requested : fallback;
  return <SignInRedirect target={safe} />;
}

function SignInRedirect({ target }: { target: string }) {
  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl={target} signUpForceRedirectUrl="/onboarding">
        <Button variant="ghost" className="hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer">Login</Button>
      </SignInButton>
      <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 shadow-md shadow-indigo-500/20 transition-all cursor-pointer font-bold">
          Start Free Trial
        </Button>
      </SignUpButton>
    </>
  );
}

export default function Home() {
  const { userId } = useAuth();
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/20 overflow-hidden font-sans">
      {/* Background ambient light effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[600px] opacity-40 pointer-events-none blur-[120px] bg-gradient-to-b from-indigo-200 via-purple-100 to-transparent"></div>
      
      {/* Navbar Fixed Top */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">Recrutva</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How it Works</a>
          </div>
          <div className="flex items-center gap-4">
            {!userId ? (
              <Suspense fallback={null}>
                <SafeRedirectPath fallback="/onboarding" />
              </Suspense>
            ) : (
              <div className="flex items-center gap-4">
                <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 shadow-sm" } }} />
                
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Logout"
                      >
                        <LogOut className="w-5 h-5" />
                      </Button>
                    }
                  />
                  <AlertDialogContent className="bg-white border-slate-200 text-slate-900 rounded-3xl shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-bold">Sign Out?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-600">
                        Are you sure you want to log out of Recrutva? You will need to sign in again to access your candidate pipeline.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                      <AlertDialogCancel className="rounded-xl border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => signOut()}
                        className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20"
                      >
                        Logout
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center pt-16 pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-28">
        
        {/* --- HERO SECTION --- */}
        <section className="flex flex-col items-center space-y-8 max-w-4xl pt-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="px-4 py-2 rounded-full border-indigo-200 bg-indigo-50 text-indigo-700 shadow-xs relative">
              <span className="relative z-10 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Groq AI Automated Hiring Engine
              </span>
            </Badge>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]"
          >
            Autonomous AI <br className="hidden md:block" /> Hiring <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">Pipelines.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed font-normal"
          >
            Configure custom multi-stage pipelines (OA Tests, AI Tech Interviews, HR Rounds). Let Groq AI parse resumes, match ATS scores, and evaluate candidates automatically.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
          >
            {!userId ? (
              <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
                <Button size="lg" className="h-14 px-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 group cursor-pointer">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </SignUpButton>
            ) : (
              <Link href="/onboarding">
                <Button size="lg" className="h-14 px-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2 group">
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            )}
          </motion.div>

          {/* Voice & Video AI Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-12 w-full max-w-3xl relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 blur-xl opacity-20 rounded-3xl"></div>
            <Card className="relative bg-white border-slate-200/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl overflow-hidden text-left">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center ring-1 ring-indigo-200 relative">
                    <Mic className="w-6 h-6 text-indigo-600" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse shadow-sm"></span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Groq AI Interviewer</h3>
                    <p className="text-xs font-semibold text-slate-500">Live Evaluation: Technical Tech Interview</p>
                  </div>
                </div>
                <div>
                  <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 font-bold px-3 py-1">
                    AI Active — 92% Match Score
                  </Badge>
                </div>
              </div>
              
              {/* Fake Audio Waves */}
              <div className="flex items-center justify-center gap-1.5 h-16 w-full bg-slate-50 rounded-2xl p-4 border border-slate-100">
                {AUDIO_WAVE_BARS.map((bar, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: ["20%", bar.height, "20%"] 
                    }}
                    transition={{ 
                      duration: bar.duration, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      delay: bar.delay
                    }}
                    className="w-1.5 bg-indigo-500 rounded-full"
                  />
                ))}
              </div>
            </Card>
          </motion.div>
        </section>

        {/* --- FEATURES SECTION --- */}
        <section id="features" className="w-full relative py-8">
          <div className="mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">Platform Features</h2>
            <p className="text-slate-600 max-w-2xl mx-auto font-normal text-base">Everything you need to automate candidate evaluation end-to-end.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <FeatureCard 
              icon={<Cpu className="w-7 h-7 text-indigo-600" />}
              title="Groq AI Match Scorer"
              description="Instant resume parsing, key skills matching, and automatic ATS candidate match percentage calculation."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Sliders className="w-7 h-7 text-purple-600" />}
              title="Pipeline Configurator"
              description="Configure 1-5 custom rounds (OA, AI Tech Interview, HR Screen, Resume Screening) with selection targets."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Layers className="w-7 h-7 text-emerald-600" />}
              title="Job Command Dashboard"
              description="Job-specific Candidate Table View, Pipeline View with per-round selection rates, and candidate resume viewer."
              delay={0.3}
            />
            <FeatureCard 
              icon={<FileCheck className="w-7 h-7 text-amber-600" />}
              title="Candidate Portal"
              description="Public role discovery, automated assessment tests, live AI technical interview room, and status tracking."
              delay={0.4}
            />
          </div>
        </section>

        {/* --- HOW IT WORKS SECTION --- */}
        <section id="how-it-works" className="w-full relative py-8">
          <div className="mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">How Recrutva Works</h2>
            <p className="text-slate-600 max-w-2xl mx-auto font-normal text-base">Automate your entire hiring flow in three simple steps.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Users className="w-7 h-7 text-indigo-600" />}
              title="1. Configure & Post Job"
              description="Set up your job title and custom evaluation pipeline (OA, AI Interview, HR Round) with target selection rates."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Mic className="w-7 h-7 text-purple-600" />}
              title="2. AI Assessment & Interview"
              description="Candidates apply and complete Groq-powered technical assessment tests and interactive AI interviews."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Calendar className="w-7 h-7 text-emerald-600" />}
              title="3. Track & Progress Talent"
              description="Evaluate candidates in Table View or Pipeline View with live round selection rates and instant stage progression."
              delay={0.3}
            />
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="w-full max-w-4xl pt-8">
          <div className="relative rounded-3xl p-10 md:p-14 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-xl shadow-indigo-600/15">
            <div className="relative z-10 flex flex-col items-center text-center">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Ready to automate your hiring?</h2>
              <p className="text-indigo-100 mb-8 max-w-lg text-base">Streamline candidate screening, eliminate manual effort, and hire top talent faster.</p>
              
              <div className="flex flex-col sm:flex-row w-full max-w-md gap-3">
                <input 
                  type="email" 
                  placeholder="Enter your work email" 
                  className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white placeholder:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/40"
                />
                {!userId ? (
                  <SignUpButton mode="modal" forceRedirectUrl="/onboarding">
                    <Button className="bg-white hover:bg-slate-50 text-indigo-700 rounded-xl py-6 px-6 font-bold cursor-pointer shadow-md">
                      Get Access
                    </Button>
                  </SignUpButton>
                ) : (
                  <Link href="/onboarding">
                    <Button className="bg-white hover:bg-slate-50 text-indigo-700 rounded-xl py-6 px-6 font-bold cursor-pointer shadow-md">
                      Go to Dashboard
                    </Button>
                  </Link>
                )}
              </div>
              
              <div className="flex items-center gap-6 mt-8 text-sm text-indigo-100 font-medium">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Full Automation Pipeline</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Groq AI Engine</div>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-slate-700">© 2026 Recrutva. Built by Divya Saxena.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium">
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
            <a
              href="https://www.linkedin.com/in/divyasaxena24/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
            >
              <svg className="w-4 h-4 text-indigo-600 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
              LinkedIn
            </a>
            <a
              href="https://github.com/divysaxena24"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-800 fill-current" viewBox="0 0 24 24">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
              </svg>
              GitHub
            </a>
            <a
              href="mailto:divysaxena2402@gmail.com"
              className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
            >
              <Mail className="w-4 h-4 text-rose-500" /> divysaxena2402@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
    >
      <Card className="flex flex-col h-full bg-white border-slate-200/80 p-8 shadow-xs hover:shadow-xl hover:border-indigo-300 transition-all rounded-3xl text-left">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 shadow-2xs">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-600 leading-relaxed text-sm">
          {description}
        </p>
      </Card>
    </motion.div>
  );
}
