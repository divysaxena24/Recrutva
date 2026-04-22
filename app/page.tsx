"use client";

import { motion } from "framer-motion";
import { ArrowRight, Mic, Users, Calendar, BarChart3, Bot, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";

export default function Home() {
  const { userId } = useAuth();
  return (
    <div className="min-h-screen bg-black text-slate-50 selection:bg-indigo-500/30 overflow-hidden">
      {/* Background ambient light effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[600px] opacity-20 pointer-events-none blur-[120px] bg-gradient-to-b from-indigo-500 via-purple-500/20 to-transparent"></div>
      
      {/* Navbar Minimal */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/30">
            <Bot className="w-6 h-6 text-indigo-400" />
          </div>
          <span className="font-bold text-xl tracking-tight">Recrutva</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          {!userId ? (
            <>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
                <Button variant="ghost" className="hover:bg-white/5 hover:text-white cursor-pointer">Login</Button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all cursor-pointer">
                  Start Free Trial
                </Button>
              </SignUpButton>
            </>
          ) : (
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10" } }} />
          )}
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center justify-center pt-24 pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-24">
        
        {/* --- HERO SECTION --- */}
        <section className="flex flex-col items-center space-y-8 max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="px-4 py-2 rounded-full border-indigo-500/30 bg-indigo-500/10 text-indigo-300 backdrop-blur-md backdrop-saturate-150 relative">
              <span className="relative z-10 flex items-center gap-2 text-sm font-medium">
                <Sparkles className="w-4 h-4" /> Recrutva Voice SDK 2.0 is live
              </span>
            </Badge>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500"
          >
            Hire at the speed <br className="hidden md:block" /> of <span className="text-indigo-400">Voice.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-slate-400 max-w-2xl leading-relaxed"
          >
            Import candidates, and let our AI Voice Agent handle the screening. Reclaim your time, reduce bias, and find the perfect match automatically.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 pt-4"
          >
            <Button size="lg" className="h-14 px-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-medium shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all flex items-center gap-2 group">
              Start Hiring with AI
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 rounded-full border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-lg font-medium backdrop-blur-md">
              Book Demo
            </Button>
          </motion.div>

          {/* Voice Visualization Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 w-full max-w-3xl relative"
          >
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full"></div>
            <Card className="relative bg-slate-900/60 border-slate-700/50 backdrop-blur-xl p-8 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center ring-2 ring-indigo-500/50 relative">
                    <Mic className="w-6 h-6 text-indigo-400" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white">AI Agent Sarah</h3>
                    <p className="text-sm text-slate-400">Interviewing: Alex Johnson</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                    Live Call - 04:23
                  </Badge>
                </div>
              </div>
              
              {/* Fake Audio Waves */}
              <div className="flex items-center justify-center gap-1.5 h-16 w-full">
                {[...Array(30)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: ["20%", `${Math.random() * 80 + 20}%`, "20%"] 
                    }}
                    transition={{ 
                      duration: Math.random() * 0.5 + 0.5, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      delay: Math.random() * 0.2
                    }}
                    className="w-1.5 bg-indigo-500/50 rounded-full"
                  />
                ))}
              </div>
            </Card>
          </motion.div>
        </section>

        {/* --- HOW IT WORKS SECTION --- */}
        <section id="how-it-works" className="w-full relative py-12">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">How Recrutva Works</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Automate your entire screening flow in three simple steps.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Users className="w-8 h-8 text-indigo-400" />}
              title="1. Import Candidates"
              description="Upload CVs or sync with your ATS. Recrutva instantly parses details to prepare for the screening."
              delay={0.1}
            />
            <FeatureCard 
              icon={<Mic className="w-8 h-8 text-purple-400" />}
              title="2. AI Voice Screening"
              description="Our agent calls candidates, conducting nuanced interviews customized to the role."
              delay={0.2}
            />
            <FeatureCard 
              icon={<Calendar className="w-8 h-8 text-pink-400" />}
              title="3. Auto-Schedule"
              description="Top performers are automatically advanced and scheduled for a human review."
              delay={0.3}
            />
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="w-full max-w-4xl pt-16">
          <div className="relative rounded-3xl p-12 overflow-hidden border border-slate-800 bg-slate-900/50">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20" />
            <div className="absolute inset-0 bg-grid-white/[0.02]" />
            <div className="relative z-10 flex flex-col items-center">
              <h2 className="text-3xl font-bold text-white mb-6">Ready to scale your hiring?</h2>
              <p className="text-slate-400 mb-8 max-w-lg">Join 500+ forward-thinking teams saving thousands of hours previously spent on initial screening calls.</p>
              
              <div className="flex flex-col sm:flex-row w-full max-w-md gap-3">
                <input 
                  type="email" 
                  placeholder="Enter your work email" 
                  className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-6 px-6">
                  Get Access
                </Button>
              </div>
              
              <div className="flex items-center gap-4 mt-6 text-sm text-slate-400">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> No credit card required</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> 14-day free trial</div>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      {/* Footer */}
      <footer className="border-t border-slate-800/60 mt-12 py-12 text-center text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400/50" />
            <span>© 2026 Recrutva. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300">Privacy</a>
            <a href="#" className="hover:text-slate-300">Terms</a>
            <a href="#" className="hover:text-slate-300">Twitter</a>
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
      whileHover={{ y: -5 }}
    >
      <Card className="flex flex-col h-full bg-slate-900/40 border-slate-800/80 p-8 backdrop-blur-sm shadow-xl hover:border-indigo-500/30 transition-colors">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mb-6 ring-1 ring-white/5 shadow-inner">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-white mb-3 text-left">{title}</h3>
        <p className="text-slate-400 text-left leading-relaxed text-sm">
          {description}
        </p>
      </Card>
    </motion.div>
  );
}
