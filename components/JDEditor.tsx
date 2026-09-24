"use client";

import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPLOYMENT_TYPES, WORK_MODES, type JobDescription } from "@/lib/schemas/jd";

/**
 * Structured editor for a generated job description.
 *
 * Sections are edited individually rather than as one giant textarea, so the
 * recruiter can fix a single responsibility or skill without rewriting the
 * whole document. Fully controlled — the parent owns the JD state.
 */

interface JDEditorProps {
  value: JobDescription;
  onChange: (next: JobDescription) => void;
  disabled?: boolean;
}

const LABEL_CLASS =
  "text-[10px] font-bold text-slate-600 uppercase tracking-widest";

export default function JDEditor({ value, onChange, disabled }: JDEditorProps) {
  const patch = (changes: Partial<JobDescription>) =>
    onChange({ ...value, ...changes });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="jd-title" className={LABEL_CLASS}>
          Job Title
        </Label>
        <Input
          id="jd-title"
          value={value.title}
          disabled={disabled}
          onChange={(e) => patch({ title: e.target.value })}
          className="bg-white border-slate-200 h-12 rounded-xl text-slate-900 focus:ring-indigo-500/20 shadow-xs"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jd-summary" className={LABEL_CLASS}>
          Job Overview
        </Label>
        <Textarea
          id="jd-summary"
          value={value.summary}
          disabled={disabled}
          onChange={(e) => patch({ summary: e.target.value })}
          placeholder="A short overview of the role, team and impact."
          className="bg-white border-slate-200 min-h-[110px] rounded-2xl p-4 text-slate-900 focus:ring-indigo-500/20 shadow-xs resize-y"
        />
      </div>

      <EditableList
        id="jd-responsibilities"
        label="Responsibilities"
        items={value.responsibilities}
        disabled={disabled}
        placeholder="Design and ship backend services"
        onChange={(items) => patch({ responsibilities: items })}
      />

      <EditableList
        id="jd-required-skills"
        label="Required Skills"
        items={value.requiredSkills}
        disabled={disabled}
        placeholder="Java"
        onChange={(items) => patch({ requiredSkills: items })}
      />

      <EditableList
        id="jd-preferred-skills"
        label="Preferred Skills"
        items={value.preferredSkills}
        disabled={disabled}
        placeholder="Docker"
        onChange={(items) => patch({ preferredSkills: items })}
      />

      <EditableList
        id="jd-qualifications"
        label="Qualifications"
        items={value.qualifications}
        disabled={disabled}
        placeholder="Bachelor's degree or equivalent experience"
        onChange={(items) => patch({ qualifications: items })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="jd-employment-type" className={LABEL_CLASS}>
            Employment Type
          </Label>
          <select
            id="jd-employment-type"
            value={value.employmentType}
            disabled={disabled}
            onChange={(e) =>
              patch({ employmentType: e.target.value as JobDescription["employmentType"] })
            }
            className="w-full h-12 px-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs disabled:opacity-50"
          >
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd-work-mode" className={LABEL_CLASS}>
            Work Mode
          </Label>
          <select
            id="jd-work-mode"
            value={value.workMode}
            disabled={disabled}
            onChange={(e) =>
              patch({ workMode: e.target.value as JobDescription["workMode"] })
            }
            className="w-full h-12 px-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-xs disabled:opacity-50"
          >
            {WORK_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd-experience" className={LABEL_CLASS}>
            Experience
          </Label>
          <Input
            id="jd-experience"
            value={value.experience}
            disabled={disabled}
            placeholder="2-4 years"
            onChange={(e) => patch({ experience: e.target.value })}
            className="bg-white border-slate-200 h-12 rounded-xl text-slate-900 focus:ring-indigo-500/20 shadow-xs"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd-location" className={LABEL_CLASS}>
            Location
          </Label>
          <Input
            id="jd-location"
            value={value.location}
            disabled={disabled}
            placeholder="Bangalore, India"
            onChange={(e) => patch({ location: e.target.value })}
            className="bg-white border-slate-200 h-12 rounded-xl text-slate-900 focus:ring-indigo-500/20 shadow-xs"
          />
        </div>
      </div>

      <EditableList
        id="jd-benefits"
        label="Benefits / What We Offer"
        items={value.benefits}
        disabled={disabled}
        placeholder="Flexible working hours"
        onChange={(items) => patch({ benefits: items })}
      />
    </div>
  );
}

// ─── Reusable list editor ──────────────────────────────────────────

function EditableList({
  id,
  label,
  items,
  disabled,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  items: string[];
  disabled?: boolean;
  placeholder?: string;
  onChange: (items: string[]) => void;
}) {
  const update = (index: number, text: string) => {
    const next = [...items];
    next[index] = text;
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const add = () => onChange([...items, ""]);

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      {/* `legend` must be a direct child of fieldset, so the group is named
          by a visually hidden legend while the visible label sits alongside
          the Add button. */}
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center justify-between">
        <span className={LABEL_CLASS}>{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={add}
          className="h-7 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg gap-1.5"
        >
          <Plus className="w-3 h-3" /> Add
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic">
          Nothing here yet — use Add to write one.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
              <Input
                id={`${id}-${index}`}
                value={item}
                disabled={disabled}
                placeholder={placeholder}
                aria-label={`${label} item ${index + 1}`}
                onChange={(e) => update(index, e.target.value)}
                className="bg-white border-slate-200 h-11 rounded-xl text-sm text-slate-900 focus:ring-indigo-500/20 shadow-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => remove(index)}
                aria-label={`Remove ${label} item ${index + 1}`}
                className="shrink-0 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}
