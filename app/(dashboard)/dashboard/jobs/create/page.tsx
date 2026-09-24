"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import JDEditor from "@/components/JDEditor";
import PipelineConfigurator, { DEFAULT_PIPELINE_ROUNDS, RoundConfig } from "@/components/PipelineConfigurator";
import { setupJobPipeline } from "@/app/actions/candidate-pipeline";
import {
  generateJobDraft,
  getJobForEditing,
  publishJob,
  saveJobDraft,
} from "@/app/actions/jd";
import {
  EMPLOYMENT_TYPES,
  GenerateJobInputSchema,
  WORK_MODES,
  validatePublishable,
  type GenerateJobInput,
  type JobDescription,
} from "@/lib/schemas/jd";

const LABEL_CLASS =
  "text-[10px] font-bold text-slate-600 uppercase tracking-widest";

const EMPTY_FORM: GenerateJobInput = {
  title: "",
  department: "",
  location: "Remote",
  employmentType: "Full-time",
  experience: "",
  skills: [],
  responsibilities: "",
  additionalRequirements: "",
  salaryRange: "",
  workMode: "Remote",
};

function splitSkills(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function isEmploymentType(value: string): value is JobDescription["employmentType"] {
  return (EMPLOYMENT_TYPES as readonly string[]).includes(value);
}

function isWorkMode(value: string): value is JobDescription["workMode"] {
  return (WORK_MODES as readonly string[]).includes(value);
}

export default function CreateJobPage() {
  // useSearchParams requires a Suspense boundary for prerendering.
  return (
    <Suspense fallback={<PageShell />}>
      <CreateJobView />
    </Suspense>
  );
}

function PageShell() {
  return (
    <div className="space-y-8 pb-16">
      <div className="h-12 w-72 rounded-2xl bg-slate-100 border border-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="h-96 rounded-3xl bg-slate-100 border border-slate-200 animate-pulse" />
        <div className="h-96 rounded-3xl bg-slate-100 border border-slate-200 animate-pulse" />
      </div>
    </div>
  );
}

function CreateJobView() {
  const searchParams = useSearchParams();
  const initialJobId = useMemo(() => {
    const raw = Number(searchParams.get("jobId"));
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }, [searchParams]);

  const [form, setForm] = useState<GenerateJobInput>(EMPTY_FORM);
  const [skillsText, setSkillsText] = useState("");
  const [jd, setJd] = useState<JobDescription | null>(null);
  const [generatedJd, setGeneratedJd] = useState<JobDescription | null>(null);
  const [jobId, setJobId] = useState<number | null>(initialJobId);
  const [publishedId, setPublishedId] = useState<number | null>(null);

  const [loadingJob, setLoadingJob] = useState(initialJobId !== null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const busy = generating || saving || publishing;

  useEffect(() => {
    if (initialJobId === null) return;

    let cancelled = false;

    getJobForEditing(initialJobId)
      .then((result) => {
        if (cancelled) return;

        if (!result.success) {
          setError(result.error);
          return;
        }

        const job = result.job;
        setJobId(job.id);
        setForm(result.input ?? EMPTY_FORM);
        setSkillsText((result.input?.skills ?? job.requiredSkills).join(", "));

        const hydrated: JobDescription = {
          title: job.title,
          summary: job.summary,
          responsibilities: job.responsibilities,
          requiredSkills: job.requiredSkills,
          preferredSkills: job.preferredSkills,
          qualifications: job.qualifications,
          benefits: job.benefits,
          experience: job.experience,
          location: job.location,
          employmentType: isEmploymentType(job.employmentType)
            ? job.employmentType
            : "Full-time",
          workMode: isWorkMode(job.workMode) ? job.workMode : "Remote",
        };

        setJd(hydrated);
        setGeneratedJd(hydrated);
      })
      .finally(() => {
        if (!cancelled) setLoadingJob(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialJobId]);

  const runGeneration = useCallback(
    async (input: GenerateJobInput) => {
      setGenerating(true);
      setError(null);
      setNotice(null);
      setFieldErrors({});

      try {
        const result = await generateJobDraft(input);

        if (!result.success) {
          setError(result.error);
          return;
        }

        setJd(result.jd);
        setGeneratedJd(result.jd);
        setNotice("Job description generated. Review and edit it before publishing.");
      } catch {
        setError("Something went wrong while generating. Please try again.");
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  const validateInput = (): GenerateJobInput | null => {
    setFieldErrors({});
    const parsed = GenerateJobInputSchema.safeParse({
      ...form,
      skills: splitSkills(skillsText),
    });

    if (!parsed.success) {
      const errorsMap: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const fieldName = String(issue.path[0] ?? "");
        if (fieldName && !errorsMap[fieldName]) {
          errorsMap[fieldName] = issue.message;
        }
      }
      setFieldErrors(errorsMap);
      setError(parsed.error.issues[0]?.message ?? "Please complete the required fields.");
      return null;
    }

    return parsed.data;
  };

  const handleGenerate = async () => {
    const validated = validateInput();
    if (!validated) return;
    await runGeneration(validated);
  };

  const handleRegenerate = async () => {
    const hasEdits =
      jd !== null && generatedJd !== null && JSON.stringify(jd) !== JSON.stringify(generatedJd);

    if (
      hasEdits &&
      !confirm(
        "Regenerating will replace your current edits with a new AI draft. Continue?",
      )
    ) {
      return;
    }

    await handleGenerate();
  };

  const handleReset = () => {
    if (!generatedJd) return;
    setJd(generatedJd);
    setNotice("Reverted to the last AI-generated version.");
  };

  const buildPayload = () => {
    const parsed = GenerateJobInputSchema.safeParse({
      ...form,
      skills: splitSkills(skillsText),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please complete the required fields.");
      return null;
    }
    if (!jd) {
      setError("Generate a job description before saving.");
      return null;
    }

    return { jobId, input: parsed.data, jd };
  };

  const [pipelineRounds, setPipelineRounds] = useState<RoundConfig[]>(DEFAULT_PIPELINE_ROUNDS);

  const handleSaveDraft = async () => {
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveJobDraft(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setJobId(result.jobId);

      // Persist custom pipeline rounds config
      await setupJobPipeline(
        result.jobId,
        pipelineRounds.map((r) => ({
          name: r.name,
          type: r.type,
          configuration: {
            passThreshold: r.passThreshold,
            selectTarget: r.selectTarget,
          },
        }))
      );

      setNotice("Draft saved. It is not visible to candidates until you publish it.");
    } catch {
      setError("We couldn't save this draft. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const payload = buildPayload();
    if (!payload) return;

    const incomplete = validatePublishable(payload.jd);
    if (incomplete) {
      setError(incomplete);
      return;
    }

    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await publishJob(payload);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setJobId(result.jobId);
      setPublishedId(result.jobId);

      // Persist custom pipeline rounds config
      await setupJobPipeline(
        result.jobId,
        pipelineRounds.map((r) => ({
          name: r.name,
          type: r.type,
          configuration: {
            passThreshold: r.passThreshold,
            selectTarget: r.selectTarget,
          },
        }))
      );

      setNotice("Job published. It is now visible in the public job listing.");
    } catch {
      setError("We couldn't publish this job. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const hasEdits =
    jd !== null && generatedJd !== null && JSON.stringify(jd) !== JSON.stringify(generatedJd);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <section className="space-y-3">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Back to Jobs</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-1.5">
              <Briefcase className="w-4 h-4" /> {jobId ? "Edit Job" : "Create Job"}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Build a Job Description
            </h1>
            <p className="text-slate-600 text-base max-w-2xl">
              Generate a professional job description from your requirements.
            </p>
          </div>
          {jobId && (
            <Badge className="bg-slate-100 text-slate-600 border-none px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest h-fit">
              Job #{jobId.toString().padStart(4, "0")}
            </Badge>
          )}
        </div>
      </section>

      {/* Feedback */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <p className="text-sm text-rose-800">{error}</p>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800">{notice}</p>
        </div>
      )}

      {publishedId && (
        <Link href={`/jobs/${publishedId}`} target="_blank">
          <Button
            variant="outline"
            className="h-11 px-5 rounded-full border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold shadow-xs"
          >
            <ExternalLink className="w-4 h-4 mr-2" /> View public listing
          </Button>
        </Link>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Basic Job Information */}
        <Card className="bg-white border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Basic Job Information
            </h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
              Fields marked * are required
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title" className={LABEL_CLASS}>
              Job Title *
            </Label>
            <Input
              id="title"
              value={form.title}
              disabled={busy}
              placeholder="e.g. Backend Engineer"
              onChange={(e) => {
                setForm({ ...form, title: e.target.value });
                if (fieldErrors.title) setFieldErrors({ ...fieldErrors, title: "" });
              }}
              className={`bg-white border-slate-200 h-12 rounded-xl focus:ring-indigo-500/20 text-slate-900 ${
                fieldErrors.title ? "border-rose-500 focus:ring-rose-500/20" : ""
              }`}
            />
            {fieldErrors.title && (
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">{fieldErrors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department" className={LABEL_CLASS}>
                Department
              </Label>
              <Input
                id="department"
                value={form.department}
                disabled={busy}
                placeholder="e.g. Engineering"
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="bg-white border-slate-200 h-12 rounded-xl focus:ring-indigo-500/20 text-slate-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className={LABEL_CLASS}>
                Location
              </Label>
              <Input
                id="location"
                value={form.location}
                disabled={busy}
                placeholder="e.g. Bangalore, India"
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="bg-white border-slate-200 h-12 rounded-xl focus:ring-indigo-500/20 text-slate-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employmentType" className={LABEL_CLASS}>
                Employment Type *
              </Label>
              <select
                id="employmentType"
                value={form.employmentType}
                disabled={busy}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employmentType: e.target.value as GenerateJobInput["employmentType"],
                  })
                }
                className="w-full h-12 px-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              >
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workMode" className={LABEL_CLASS}>
                Work Mode
              </Label>
              <select
                id="workMode"
                value={form.workMode}
                disabled={busy}
                onChange={(e) =>
                  setForm({ ...form, workMode: e.target.value as GenerateJobInput["workMode"] })
                }
                className="w-full h-12 px-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
              >
                {WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience" className={LABEL_CLASS}>
                Experience
              </Label>
              <Input
                id="experience"
                value={form.experience}
                disabled={busy}
                placeholder="e.g. 2-4 years"
                onChange={(e) => setForm({ ...form, experience: e.target.value })}
                className="bg-white border-slate-200 h-12 rounded-xl focus:ring-indigo-500/20 text-slate-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salaryRange" className={LABEL_CLASS}>
                Salary Range
              </Label>
              <Input
                id="salaryRange"
                value={form.salaryRange}
                disabled={busy}
                placeholder="e.g. 12-18 LPA"
                onChange={(e) => setForm({ ...form, salaryRange: e.target.value })}
                className="bg-white border-slate-200 h-12 rounded-xl focus:ring-indigo-500/20 text-slate-900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills" className={LABEL_CLASS}>
              Key Skills *
            </Label>
            <Input
              id="skills"
              value={skillsText}
              disabled={busy}
              placeholder="e.g. Java, Spring Boot, PostgreSQL, REST APIs"
              aria-describedby="skills-hint"
              onChange={(e) => {
                setSkillsText(e.target.value);
                if (fieldErrors.skills) setFieldErrors({ ...fieldErrors, skills: "" });
              }}
              className={`bg-white border-slate-200 h-12 rounded-xl focus:ring-indigo-500/20 text-slate-900 ${
                fieldErrors.skills ? "border-rose-500 focus:ring-rose-500/20" : ""
              }`}
            />
            {fieldErrors.skills && (
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mt-1">{fieldErrors.skills}</p>
            )}
            <p id="skills-hint" className="text-[11px] text-slate-500">
              Separate skills with commas.
            </p>
            {splitSkills(skillsText).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {splitSkills(skillsText).map((skill) => (
                  <Badge
                    key={skill}
                    className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-[10px] font-bold"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsibilities" className={LABEL_CLASS}>
              Responsibilities / Notes
            </Label>
            <Textarea
              id="responsibilities"
              value={form.responsibilities}
              disabled={busy}
              placeholder="Anything you already know about the day-to-day of this role."
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              className="bg-white border-slate-200 min-h-[110px] rounded-2xl p-4 focus:ring-indigo-500/20 text-slate-900 resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalRequirements" className={LABEL_CLASS}>
              Additional Requirements
            </Label>
            <Textarea
              id="additionalRequirements"
              value={form.additionalRequirements}
              disabled={busy}
              placeholder="Certifications, notice period, domain experience, etc."
              onChange={(e) => setForm({ ...form, additionalRequirements: e.target.value })}
              className="bg-white border-slate-200 min-h-[90px] rounded-2xl p-4 focus:ring-indigo-500/20 text-slate-900 resize-y"
            />
          </div>

          <PipelineConfigurator
            rounds={pipelineRounds}
            onChange={setPipelineRounds}
            disabled={busy}
          />

          <Button
            type="button"
            onClick={handleGenerate}
            disabled={busy}
            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-xs"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" /> Generate Job Description
              </>
            )}
          </Button>
        </Card>

        {/* AI Generated JD Preview */}
        <Card className="bg-white border-slate-200/80 rounded-3xl p-8 shadow-xs space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Generated Job Description
              </h2>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">
                {loadingJob
                  ? "Loading job..."
                  : jd
                    ? "AI-generated draft — review and edit before publishing."
                    : "Nothing generated yet"}
              </p>
            </div>
            {jd && (
              <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shrink-0">
                <Wand2 className="w-3 h-3 mr-1" /> AI Draft
              </Badge>
            )}
          </div>

          {loadingJob ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-11 rounded-xl bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : jd ? (
            <>
              {hasEdits && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    You have edited this draft. Regenerating will replace your changes.
                  </p>
                </div>
              )}

              <JDEditor value={jd} onChange={setJd} disabled={busy} />

              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={busy}
                  className="h-12 px-5 rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold shadow-xs"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Regenerate
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={busy || !hasEdits}
                  className="h-12 px-5 rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold shadow-xs"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Reset to generated
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={busy}
                  className="flex-1 h-14 rounded-2xl border-slate-200 text-slate-800 hover:bg-slate-50 font-bold shadow-xs"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5 mr-2" />
                  )}
                  Save Draft
                </Button>
                <Button
                  type="button"
                  onClick={handlePublish}
                  disabled={busy}
                  className="flex-1 h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                >
                  {publishing ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                  )}
                  Publish Job
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500 bg-slate-50/50 rounded-2xl border border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-900">No draft yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Generate a professional job description from your requirements. It stays a
                draft until you publish it.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
