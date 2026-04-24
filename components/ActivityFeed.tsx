"use client";

import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Phone, CheckCircle, Clock } from "lucide-react";

const activities = [
  { id: 1, type: "call", text: "Sarah is initiating a call with Alex Johnson", time: "Just now", icon: Phone, color: "text-amber-400" },
  { id: 2, type: "analysis", text: "Sarah completed skill gap analysis for Jessica Miller", time: "5m ago", icon: Sparkles, color: "text-indigo-400" },
  { id: 3, type: "interview", text: "Technical interview scheduled for Michael Chen", time: "12m ago", icon: MessageSquare, color: "text-emerald-400" },
  { id: 4, type: "complete", text: "Screening report ready for Sarah Williams", time: "25m ago", icon: CheckCircle, color: "text-blue-400" },
];

export default function ActivityFeed() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          Recent Intelligence
        </h3>
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Live Updates</span>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity, i) => (
          <motion.div 
            key={activity.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex gap-4 p-3 rounded-xl hover:bg-white/[0.02] transition-colors group cursor-pointer border border-transparent hover:border-slate-800/60"
          >
            <div className={`mt-0.5 p-2 rounded-lg bg-white/[0.03] ring-1 ring-white/5 ${activity.color} group-hover:scale-110 transition-transform`}>
              <activity.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 leading-snug group-hover:text-white transition-colors">
                {activity.text}
              </p>
              <span className="text-[10px] text-slate-500 font-medium mt-1 inline-block">
                {activity.time}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
      
      <button className="w-full py-3 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest">
        View Full Intelligence Log
      </button>
    </div>
  );
}
