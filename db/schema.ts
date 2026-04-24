import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(), // Linking to clerkId of the recruiter
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  resumeText: text("resume_text"),
  status: varchar("status", { length: 50 }).default("Ready").notNull(), // Ready, Calling, Completed, Scheduled
  score: text("score"), // AI screening score/feedback
  transcript: text("transcript"), // Full interview conversation
  summary: text("summary"), // AI generated summary for recruiter
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
