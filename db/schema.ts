import { pgTable, serial, text, timestamp, varchar, integer, jsonb } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  requirements: text("requirements"),
  location: text("location").default("Remote"),
  status: varchar("status", { length: 50 }).default("Open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const applicants = pgTable("applicants", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(), // Linking to clerkId of the recruiter
  targetJobId: integer("target_job_id").references(() => jobs.id), // Link to a specific job
  jobTitle: text("job_title"), // Direct role input
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeText: text("resume_text"),
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
