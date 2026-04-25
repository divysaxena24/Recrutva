"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Sparkles, Loader2, Briefcase, MapPin } from "lucide-react";
import { createJob } from "@/app/actions/job";

export default function AddJobModal({ onSuccess }: { onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    location: "Remote",
  });

  const handleGenerateAI = async () => {
    if (!formData.title) return alert("Please enter a job title first");
    
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formData.title }),
      });
      const data = await res.json();
      if (data.description) {
        setFormData({ ...formData, description: data.description });
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createJob(formData);
      if (res.success) {
        setIsOpen(false);
        onSuccess();
        setFormData({ title: "", description: "", requirements: "", location: "Remote" });
      }
    } catch (error) {
      console.error("Failed to create job:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={
        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 h-12 font-bold shadow-lg shadow-indigo-500/20 group">
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
          Post New Role
        </Button>
      } />
      <DialogContent className="bg-[#0a0a0f] border-slate-800 text-white sm:max-w-[600px] rounded-[2.5rem] p-0 overflow-hidden ring-1 ring-white/5">
        <div className="p-8 space-y-8">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-indigo-500/10 p-2 rounded-xl ring-1 ring-indigo-500/30">
                <Briefcase className="w-5 h-5 text-indigo-400" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">Post a New Opportunity</DialogTitle>
            </div>
            <p className="text-slate-400 text-sm">Fill in the details below or let our AI help you draft the perfect role.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Senior Frontend Developer"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="location"
                    placeholder="Remote, NYC, etc."
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="bg-slate-950 border-slate-800 h-12 rounded-xl pl-10 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Description</Label>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleGenerateAI}
                  disabled={generating || !formData.title}
                  className="h-7 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg gap-1.5"
                >
                  {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Generate with AI
                </Button>
              </div>
              <Textarea
                id="description"
                placeholder="Describe the role, responsibilities, and expectations..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                className="bg-slate-950 border-slate-800 min-h-[150px] rounded-2xl p-4 focus:ring-indigo-500/30 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requirements" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Requirements (Optional)</Label>
              <Input
                id="requirements"
                placeholder="e.g. 5+ years React, TypeScript, Node.js"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="bg-slate-950 border-slate-800 h-12 rounded-xl focus:ring-indigo-500/30"
              />
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="flex-1 h-12 rounded-xl text-slate-400 hover:bg-white/5 font-bold">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Post Job Opening"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
