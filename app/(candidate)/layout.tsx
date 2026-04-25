"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  Bot, 
  Briefcase,
  Home, 
  Menu, 
  ArrowLeftRight
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const sidebarItems = [
  { name: "My Dashboard", icon: Home, href: "/candidate-dashboard" },
  { name: "Explore Jobs", icon: Briefcase, href: "/jobs" },
];

export default function CandidateLayout({
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
          <div className="flex items-center gap-3 px-6 py-8">
            <div className="bg-emerald-500/10 p-2.5 rounded-2xl ring-1 ring-emerald-500/30">
              <Bot className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight leading-none">Recrutva</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Candidate</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1.5 py-4">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group
                    ${isActive 
                      ? "bg-emerald-600/10 text-emerald-400 ring-1 ring-emerald-500/20" 
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100"}
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "group-hover:text-emerald-300"}`} />
                  <span className="font-semibold text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 space-y-3 border-t border-slate-800/60">
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20 hover:bg-indigo-500/20 transition-all group">
              <ArrowLeftRight className="w-4 h-4 text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Switch to</span>
                <span className="text-sm font-bold text-white">Hiring Manager</span>
              </div>
            </Link>

            <div className="flex items-center gap-3 bg-white/[0.03] rounded-2xl p-3 ring-1 ring-white/5">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-white truncate">{user?.fullName || "Candidate"}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Candidate</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 bg-[#050505] border-b border-slate-800/40">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-400">
              <Menu className="w-6 h-6" />
            </Button>
            <h2 className="text-lg font-bold text-white hidden lg:block">Candidate Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <UserButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10 scrollbar-hide">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
