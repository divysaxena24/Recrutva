"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { extractSkills } from "@/lib/skillsync";

interface ParsedResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateName: string;
  resumeFileName?: string | null;
  resumeText: string | null;
}

export default function ParsedResumeModal({
  isOpen,
  onClose,
  candidateName,
  resumeFileName,
  resumeText,
}: ParsedResumeModalProps) {
  const [copied, setCopied] = useState(false);

  const text = resumeText?.trim() || "No parsed resume text available for this candidate.";
  const extractedSkills = extractSkills(text);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="bg-white border-slate-200 text-slate-900 max-w-3xl rounded-[2rem] p-0 overflow-hidden shadow-2xl">
        <div className="p-8 space-y-6 max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-2xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                    Parsed Resume & SkillSync NLP
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 font-medium">
                    {candidateName} {resumeFileName ? `• ${resumeFileName}` : ""}
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold gap-1.5"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                {copied ? "Copied" : "Copy Text"}
              </Button>
            </div>
          </DialogHeader>

          {/* SkillSync Detected Skills */}
          {extractedSkills.length > 0 && (
            <div className="shrink-0 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Detected Technical & Professional Skills ({extractedSkills.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {extractedSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="bg-white/90 text-indigo-800 border border-indigo-200 text-xs font-semibold px-2.5 py-1 rounded-lg shadow-2xs"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Resume Text */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-sm leading-relaxed text-slate-800 font-mono whitespace-pre-wrap scrollbar-hide">
            {text}
          </div>

          <div className="shrink-0 flex justify-end">
            <Button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 h-10 text-xs font-bold"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
