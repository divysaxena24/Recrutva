"use client";

import { motion } from "framer-motion";
import { ArrowRight, Mic, Users, Calendar, Bot, Sparkles, CheckCircle2 } from "lucide-react";
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
import { LogOut } from "lucide-react";
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
 * bounces an unauthenticated visitor away from a protected route, so after
 * signing in they land where they were originally headed. Defaults to
 * /onboarding, which routes users to the right dashboard based on their role.
 */
function SafeRedirectPath({ fallback }: { fallback: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("redirect") ?? "";
  // Only allow same-origin relative paths (never "//host" protocol-relative).
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
      
      {/* Navbar Minimal */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900">Recrutva</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">How it Works</a>
            <Link href="/jobs" className="hover:text-indigo-600 transition-colors">Browse Jobs</Link>
            <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
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

      <main className="relative z-10 flex flex-col items-center justify-center pt-16 pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-24">
        
        {/* --- HERO SECTION --- */}
        <section className="flex flex-col items-center space-y-8 max-w-4xl pt-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="px-4 py-2 rounded-full border-indigo-200 bg-indigo-50 text-indigo-700 shadow-xs relative">
              <span className="relative z-10 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Recrutva Voice SDK 2.0 is live
              </span>
            </Badge>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1]"
          >
            Hire at the speed <br className="hidden md:block" /> of <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">Voice.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed font-normal"
          >
            Import candidates, and let our AI Voice Agent handle the screening. Reclaim your time, reduce bias, and find the perfect match automatically.
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
                  Get Started
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

          {/* Voice Visualization Mockup */}
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
                    <h3 className="font-bold text-slate-900 text-base">AI Agent Sarah</h3>
                    <p className="text-xs font-semibold text-slate-500">Interviewing: Alex Johnson</p>
                  </div>
                </div>
                <div>
                  <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 font-bold px-3 py-1">
                    Live Call - 04:23
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

        {/* --- HOW IT WORKS SECTION --- */}
        <section id="how-it-works" className="w-full relative py-8">
          <div className="mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-3 tracking-tight">How Recrutva Works</h2>
            <p className="text-slate-600 max-w-2xl mx-auto font-normal text-base">Automate your entire screening flow in three simple steps.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Users className="w-7 h-7 text-indigo-600" />}
              title="1. Import Candidates"
              description="Upload CVs or sync with your ATS. Recrutva instantly parses details to prepare for the screening."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Mic className="w-7 h-7 text-purple-600" />}
              title="2. AI Voice Screening"
              description="Our agent calls candidates, conducting nuanced interviews customized to the role."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Calendar className="w-7 h-7 text-emerald-600" />}
              title="3. Auto-Schedule"
              description="Top performers are automatically advanced and scheduled for a human review."
              delay={0.3}
            />
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="w-full max-w-4xl pt-8">
          <div className="relative rounded-3xl p-10 md:p-14 overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 text-white shadow-xl shadow-indigo-600/15">
            <div className="relative z-10 flex flex-col items-center text-center">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 tracking-tight">Ready to scale your hiring?</h2>
              <p className="text-indigo-100 mb-8 max-w-lg text-base">Join 500+ forward-thinking teams saving thousands of hours previously spent on initial screening calls.</p>
              
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
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> No credit card required</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> 14-day free trial</div>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-10 text-center text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-slate-700">© 2026 Recrutva. All rights reserved.</span>
          </div>
          <div className="flex gap-6 font-medium">
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Twitter</a>
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
      <Card className="flex flex-col h-full bg-white border-slate-200/80 p-8 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all rounded-3xl text-left">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 shadow-xs">
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

