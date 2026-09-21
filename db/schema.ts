import { pgTable, serial, text, timestamp, varchar, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

// ─── Role Enum ────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["RECRUITER", "CANDIDATE"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role"), // nullable: null until onboarding completes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Job status values.
 *
 * `DRAFT` and `PUBLISHED` are used by the AI Job Description workflow.
 * `Open` is the legacy value used by manually-created jobs and is still
 * treated as publicly visible — see PUBLIC_JOB_STATUSES.
 */
export const JOB_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "Open"] as const;

/** Statuses that may appear in public/candidate-facing listings. */
export const PUBLIC_JOB_STATUSES = ["PUBLISHED", "Open"] as const;

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  location: text("location").default("Remote"),
  status: varchar("status", { length: 50 }).default("Open").notNull(),

  // ─── AI Job Description fields ──────────────────────────────────
  // Structured JD data produced by lib/jd-generator.ts. `description`
  // above holds the rendered text so existing consumers (public listing,
  // resume screening) keep working unchanged.
  department: text("department"),
  employmentType: varchar("employment_type", { length: 50 }),
  experience: varchar("experience", { length: 100 }),
  workMode: varchar("work_mode", { length: 50 }),
  salaryRange: varchar("salary_range", { length: 100 }),
  summary: text("summary"),
  responsibilities: jsonb("responsibilities").$type<string[]>(),
  requiredSkills: jsonb("required_skills").$type<string[]>(),
  preferredSkills: jsonb("preferred_skills").$type<string[]>(),
  qualifications: jsonb("qualifications").$type<string[]>(),
  benefits: jsonb("benefits").$type<string[]>(),

  // The recruiter's original form input, so "Regenerate" always runs from
  // the source requirements rather than previously generated/edited text.
  sourceInput: jsonb("source_input").$type<Record<string, unknown>>(),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const applicants = pgTable("applicants", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(), // Linking to clerkId of the recruiter
  clerkUserId: varchar("clerk_user_id", { length: 255 }), // Linking to clerkId of the candidate (nullable for anonymous)
  targetJobId: integer("target_job_id").references(() => jobs.id), // Link to a specific job
  jobTitle: text("job_title"), // Direct role input
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeText: text("resume_text"),
  resumeUrl: text("resume_url"), // Cloudinary download URL
  resumeFileName: text("resume_file_name"), // Original uploaded file name
  resumePublicId: text("resume_public_id"), // Cloudinary public_id for management
  status: varchar("status", { length: 50 }).default("Ready").notNull(), // Ready, Calling, Completed, Scheduled
  score: text("score"), // AI screening score/feedback
  matchScore: text("match_score"), // Match score with the job
  transcript: text("transcript"), // Full interview conversation
  summary: text("summary"), // AI generated summary for recruiter
  analysis: jsonb("analysis"), // Full JSON breakdown of answers and marks
  scheduledAt: timestamp("scheduled_at"), // Interview date/time
  lastNotifiedAt: timestamp("last_notified_at"), // Last reminder sent
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Pipeline Tables ───────────────────────────────────────────────

export const pipelines = pgTable("pipelines", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pipelineRounds = pgTable("pipeline_rounds", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id").references(() => pipelines.id).notNull(),
  name: text("name").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  order: integer("order").notNull(),
  configuration: jsonb("configuration").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const candidateRounds = pgTable("candidate_rounds", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => applicants.id).notNull(),
  roundId: integer("round_id").references(() => pipelineRounds.id).notNull(),
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  score: integer("score"),
  feedback: text("feedback"),
  evaluation: jsonb("evaluation"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
