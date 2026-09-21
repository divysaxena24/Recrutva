-- ─── Structured fields for the AI Job Description workflow ────────────────
-- `description` remains the rendered text used by the public listing and
-- resume screening; these columns hold the structured JD so downstream AI
-- features (matching, interview generation) can consume individual sections.

ALTER TABLE "jobs" ADD COLUMN "department" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "employment_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "experience" varchar(100);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "work_mode" varchar(50);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "salary_range" varchar(100);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "summary" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "responsibilities" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "required_skills" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "preferred_skills" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "qualifications" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "benefits" jsonb;
--> statement-breakpoint
-- The recruiter's original input, so "Regenerate" runs from source
-- requirements rather than previously generated or edited text.
ALTER TABLE "jobs" ADD COLUMN "source_input" jsonb;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
