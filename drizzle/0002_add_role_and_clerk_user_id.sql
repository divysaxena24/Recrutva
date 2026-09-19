-- Create the user_role enum type
DO $$ BEGIN
  CREATE TYPE "user_role" AS ENUM ('RECRUITER', 'CANDIDATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
-- Add role column to users (nullable for backward compatibility)
ALTER TABLE "users" ADD COLUMN "role" "user_role";

--> statement-breakpoint
-- Add clerk_user_id to applicants for candidate identity linking
ALTER TABLE "applicants" ADD COLUMN "clerk_user_id" varchar(255);
