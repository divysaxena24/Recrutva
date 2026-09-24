"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  Bot, 
  Users, 
  Home, 
  Calendar,
  Menu, 
  Briefcase,
  User,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/80 transform transition-transform duration-300 ease-in-out shadow-xs
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="flex items-center gap-3 px-6 py-7 border-b border-slate-100">
            <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-md shadow-indigo-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight leading-none text-slate-900">Recrutva</span>
              <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">AI Hiring</span>
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
                    flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group relative font-semibold text-sm
                    ${isActive 
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs" 
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"}
                  `}
                >
                  <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "text-indigo-600 scale-105" : "text-slate-400 group-hover:text-indigo-600 group-hover:scale-105"}`} />
                  <span className="tracking-tight">{item.name}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="sidebar-active"
                      className="absolute right-3.5 w-2 h-2 rounded-full bg-indigo-600 shadow-sm" 
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Dashboard Switcher */}
          <div className="px-4 py-3 border-t border-slate-100">
            <Link
              href="/candidate-dashboard"
              className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 transition-all group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">Candidate Portal</span>
                  <span className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Switch Dashboard</span>
                </div>
              </div>
              <ArrowRightLeft className="w-4 h-4 text-emerald-700 opacity-70 group-hover:opacity-100 group-hover:rotate-180 transition-all shrink-0" />
            </Link>
          </div>

          {/* Sidebar Footer: User Profile */}
          <div className="p-4 space-y-3 border-t border-slate-100">
            <div className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 transition-all rounded-2xl p-3 border border-slate-200/80 group cursor-pointer">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9 shadow-xs" } }} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-slate-900 truncate">
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
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
          {/* Left: App Name / Mobile Menu */}
          <div className="flex items-center gap-4 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-slate-600 hover:bg-slate-100 mr-2"
            >
              <Menu className="w-6 h-6" />
            </Button>

            <div className="hidden lg:flex items-center gap-2.5">
              <div className="bg-indigo-50 border border-indigo-200 p-1.5 rounded-xl">
                <Bot className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="font-extrabold text-lg text-slate-900">Recrutva</span>
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <div className="bg-indigo-50 border border-indigo-200 p-1.5 rounded-xl">
                <Bot className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="font-extrabold text-lg text-slate-900">Recrutva</span>
            </div>
          </div>

          {/* Right: Notifications & User Profile Icon */}
          <div className="flex items-center gap-4">
            <Link href="/candidate-dashboard" className="hidden sm:inline-flex">
              <Button variant="outline" className="h-9 px-4 rounded-full border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold gap-2 shadow-xs">
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" /> Candidate Portal
              </Button>
            </Link>
            <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex flex-col items-end mr-1">
                <span className="text-xs font-bold text-slate-900 leading-none mb-1">{user?.firstName}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Recruiter</span>
              </div>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10 ring-2 ring-indigo-500/30" } }} />
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

