"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { 
  Bot, 
  Briefcase,
  Home, 
  Menu,
  UserCheck,
  ArrowRightLeft,
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
          <div className="flex items-center gap-3 px-6 py-7 border-b border-slate-100">
            <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-md shadow-emerald-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight leading-none text-slate-900">Recrutva</span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">Candidate</span>
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
                    flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-200 group font-semibold text-sm
                    ${isActive 
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs" 
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"}
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-emerald-600" : "text-slate-400 group-hover:text-emerald-600"}`} />
                  <span className="tracking-tight">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Dashboard Switcher */}
          <div className="px-4 py-3 border-t border-slate-100">
            <Link
              href="/dashboard"
              className="flex items-center justify-between p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-800 transition-all group shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-900 truncate">Recruiter Portal</span>
                  <span className="text-[9px] text-indigo-700 font-bold uppercase tracking-wider">Switch Dashboard</span>
                </div>
              </div>
              <ArrowRightLeft className="w-4 h-4 text-indigo-700 opacity-70 group-hover:opacity-100 group-hover:rotate-180 transition-all shrink-0" />
            </Link>
          </div>

          <div className="p-4 space-y-3 border-t border-slate-100">
            <div className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 transition-all rounded-2xl p-3 border border-slate-200/80">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9 shadow-xs" } }} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold text-slate-900 truncate">{user?.fullName || "Candidate"}</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Candidate</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
          <div className="flex items-center gap-4 flex-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-600">
              <Menu className="w-6 h-6" />
            </Button>
            <h2 className="text-lg font-bold text-slate-900 hidden lg:block">Candidate Dashboard</h2>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hidden sm:inline-flex">
              <Button variant="outline" className="h-9 px-4 rounded-full border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-xs font-bold gap-2 shadow-xs">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" /> Recruiter Portal
              </Button>
            </Link>
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

