"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  Bot, 
  Users, 
  Settings, 
  Home, 
  Calendar,
  Menu, 
  X,
  Bell,
  Search,
  Briefcase,
  ArrowLeftRight
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const sidebarItems = [
  { name: "Home", icon: Home, href: "/dashboard" },
  { name: "Jobs", icon: Briefcase, href: "/dashboard/jobs" },
  { name: "Candidates", icon: Users, href: "/dashboard/candidates" },
  { name: "Schedules", icon: Calendar, href: "/dashboard/schedules" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <div className="flex h-screen bg-[#050505] text-slate-50 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0f] border-r border-slate-800/60 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center gap-3 px-6 py-8">
            <div className="bg-indigo-500/10 p-2.5 rounded-2xl ring-1 ring-indigo-500/30">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight leading-none">Recrutva</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">AI Hiring</span>
            </div>
          </div>

          <div className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-hide py-4">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                    ${isActive 
                      ? "bg-indigo-600/10 text-indigo-400 ring-1 ring-indigo-500/20" 
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}
                  `}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? "text-indigo-400 scale-110" : "group-hover:text-indigo-300 group-hover:scale-105"}`} />
                  <span className="font-semibold text-sm tracking-tight">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute right-3 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]" 
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Sidebar Footer: User Profile */}
          <div className="p-4 space-y-3 border-t border-slate-800/60">
            {/* Role Switcher */}
            <Link href="/candidate-dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 transition-all group">
              <ArrowLeftRight className="w-4 h-4 text-emerald-400 group-hover:rotate-180 transition-transform duration-500" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Switch to</span>
                <span className="text-sm font-bold text-white">Candidate</span>
              </div>
            </Link>

            <div className="flex items-center gap-3 bg-white/[0.03] hover:bg-white/[0.06] transition-all rounded-2xl p-3 ring-1 ring-white/5 group cursor-pointer">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-white truncate">
                  {user?.fullName || "Recruiter"}
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                  Hiring Manager
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header (Desktop & Mobile) */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 bg-[#050505] border-b border-slate-800/40">
          {/* Left: Search Bar (Desktop) / App Name (Mobile) */}
          <div className="flex items-center gap-4 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-400 mr-2"
            >
              <Menu className="w-6 h-6" />
            </Button>
            
            <div className="hidden lg:flex items-center gap-3 bg-slate-900/50 border border-slate-800/60 rounded-xl px-4 py-2 w-full max-w-md focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
              <Search className="w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search candidates, jobs, or schedules..." 
                className="bg-transparent border-none text-sm text-slate-300 focus:outline-none w-full placeholder:text-slate-600"
              />
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <Bot className="w-6 h-6 text-indigo-400" />
              <span className="font-bold text-lg">Recrutva</span>
            </div>
          </div>

          {/* Right: Notifications & User Profile Icon */}
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-slate-800/60 mx-2 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-xs font-bold text-white leading-none mb-1">{user?.firstName}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Recruiter</span>
              </div>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 ring-2 ring-indigo-500/20 ring-offset-2 ring-offset-[#050505]" } }} />
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function NotificationItem({ title, desc, time, dot }: { title: string, desc: string, time: string, dot: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer group/item">
      <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-white uppercase tracking-tight">{title}</p>
          <span className="text-[9px] text-slate-600 font-bold">{time}</span>
        </div>
        <p className="text-[10px] text-slate-400 truncate mt-0.5 group-hover/item:text-slate-300 transition-colors">{desc}</p>
      </div>
    </div>
  );
}
