"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Plus, Trash2, Sliders, CheckCircle2 } from "lucide-react";

export type RoundConfig = {
  name: string;
  type: string;
  passThreshold: number; // e.g. 70 (%)
  selectTarget: string; // e.g. "80%" or "10 candidates"
};

const ROUND_TYPE_OPTIONS = [
  { value: "RESUME_SCREENING", label: "Resume Screening" },
  { value: "ASSESSMENT", label: "OA / Online Assessment" },
  { value: "AI_INTERVIEW", label: "AI Tech Interview" },
  { value: "HR_ROUND", label: "HR Round / Phone Screen" },
  { value: "MANUAL_REVIEW", label: "Manual Review" },
] as const;

export const DEFAULT_PIPELINE_ROUNDS: RoundConfig[] = [
  {
    name: "Resume Screening",
    type: "RESUME_SCREENING",
    passThreshold: 70,
    selectTarget: "80%",
  },
  {
    name: "Technical OA",
    type: "ASSESSMENT",
    passThreshold: 70,
    selectTarget: "70%",
  },
  {
    name: "AI Tech Interview",
    type: "AI_INTERVIEW",
    passThreshold: 75,
    selectTarget: "60%",
  },
];

interface PipelineConfiguratorProps {
  rounds: RoundConfig[];
  onChange: (rounds: RoundConfig[]) => void;
  disabled?: boolean;
}

export default function PipelineConfigurator({
  rounds,
  onChange,
  disabled = false,
}: PipelineConfiguratorProps) {
  const handleNumRoundsChange = (num: number) => {
    const validNum = Math.min(5, Math.max(1, num));
    let updated = [...rounds];

    if (validNum > updated.length) {
      // Add default round
      const nextOrder = updated.length + 1;
      const defaultOptions: RoundConfig[] = [
        { name: "Resume Screening", type: "RESUME_SCREENING", passThreshold: 70, selectTarget: "80%" },
        { name: "Technical OA", type: "ASSESSMENT", passThreshold: 70, selectTarget: "70%" },
        { name: "AI Tech Interview", type: "AI_INTERVIEW", passThreshold: 75, selectTarget: "60%" },
        { name: "HR Round", type: "HR_ROUND", passThreshold: 80, selectTarget: "50%" },
        { name: "Final Managerial Review", type: "MANUAL_REVIEW", passThreshold: 85, selectTarget: "30%" },
      ];
      while (updated.length < validNum) {
        const nextDefault = defaultOptions[updated.length] || {
          name: `Round ${updated.length + 1}`,
          type: "ASSESSMENT",
          passThreshold: 70,
          selectTarget: "50%",
        };
        updated.push(nextDefault);
      }
    } else if (validNum < updated.length) {
      updated = updated.slice(0, validNum);
    }

    onChange(updated);
  };

  const updateRound = (index: number, field: keyof RoundConfig, value: any) => {
    const updated = [...rounds];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-6 bg-slate-50 border border-slate-200/80 rounded-3xl p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" /> Pipeline Automation Setup
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure up to 5 rounds, candidate selection targets, and pass thresholds.
          </p>
        </div>

        {/* Number of Rounds Selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs">
          <span className="text-xs font-bold text-slate-600 pl-2">Rounds:</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => handleNumRoundsChange(n)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                rounds.length === n
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Rounds Config Cards */}
      <div className="space-y-4">
        {rounds.map((r, index) => (
          <div
            key={index}
            className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  Round {index + 1}
                </Badge>
                <span className="text-xs font-bold text-slate-800">
                  {r.name || `Round ${index + 1}`}
                </span>
              </div>
              {rounds.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(rounds.filter((_, i) => i !== index))}
                  className="text-slate-400 hover:text-rose-600 text-xs transition-colors p-1"
                  title="Remove Round"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Round Name */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Round Name *
                </Label>
                <Input
                  value={r.name}
                  disabled={disabled}
                  placeholder="e.g. Technical Interview"
                  onChange={(e) => updateRound(index, "name", e.target.value)}
                  className="h-10 bg-slate-50 border-slate-200 text-xs font-medium rounded-xl text-slate-900"
                />
              </div>

              {/* Round Type */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Round Type *
                </Label>
                <select
                  value={r.type}
                  disabled={disabled}
                  onChange={(e) => updateRound(index, "type", e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {ROUND_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selection Target & Pass Threshold */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Select Target (% or Count) *
                </Label>
                <Input
                  value={r.selectTarget}
                  disabled={disabled}
                  placeholder="e.g. 70% or 10 candidates"
                  onChange={(e) => updateRound(index, "selectTarget", e.target.value)}
                  className="h-10 bg-slate-50 border-slate-200 text-xs font-medium rounded-xl text-slate-900"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
