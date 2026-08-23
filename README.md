# Recrutva

An AI-powered recruitment platform that helps recruiters create job openings, receive candidate applications, run AI voice interviews, and evaluate candidates through a configurable hiring pipeline.

## Overview

Recrutva connects two user groups:

- **Recruiters** manage job posts, review applicants, run AI screening interviews, and track candidates through hiring stages.
- **Candidates** browse open positions, apply with their resume, complete an AI interview with voice support, and track their application status.

AI is used throughout the platform for resume-to-job match scoring, interview question generation, voice-based interview delivery, and automated evaluation with per-question breakdowns.

## Features

### Recruiter

- Secure authentication and job ownership via Clerk
- Recruiter dashboard with hiring metrics
- Create, list, search, and delete job openings
- AI-assisted job description generation
- Candidate management with search, filtering, and editing
- View applications per job with ATS match scores
- Resume viewing via Cloudinary-hosted URLs
- Interview schedule management with rescheduling
- Completed interview summary with per-question scoring and AI feedback
- Configurable hiring pipeline per job with multiple round types

### Candidate

- Public job board
- Job detail and application page with resume upload
- Duplicate application prevention
- Candidate dashboard for tracking applications
- AI interview room with browser camera/microphone support
- Speech-to-text via browser speech recognition with manual text fallback
- AI-generated interview result page after completion

### AI & Automation

- Groq-powered job description generation
- Groq-powered resume-to-job match scoring (ATS score)
- Groq-powered interview question generation (10 role-specific questions)
- Groq-powered interview evaluation with executive summary and per-question breakdown
- Google TTS for AI interviewer voice playback
- Nodemailer-based interview invitation and daily reminder emails
- Vercel cron for recurring interview reminders

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS 4, shadcn/ui (base-nova style), Lucide icons |
| Auth | Clerk |
| Database | Neon PostgreSQL |
| ORM | Drizzle ORM |
| AI | Groq SDK |
| Voice | Google TTS API, Web Speech API (browser) |
| File Storage | Cloudinary |
| Email | Nodemailer (Gmail) |
| Charts | Recharts |
| Animation | Framer Motion |
| Validation | Zod, React Hook Form |
| PDF Parsing | pdf-parse |
| DOCX Parsing | Mammoth |
| Deployment | Vercel |

## Database Architecture

Six tables defined in `db/schema.ts` with the following relationships:

```
jobs ──> pipelines ──> pipeline_rounds ──> candidate_rounds ──> applicants
                                                              └──> jobs (via targetJobId)
users ──> jobs (via userId = clerkId)
users ──> applicants (via userId = clerkId)
```

### Tables

| Table | Purpose |
| --- | --- |
| `users` | Recruiter accounts (Clerk ID, name, email) |
| `jobs` | Job openings (title, description, requirements, location, status) |
| `applicants` | Candidates and their application data (resume, scores, transcripts, interview analysis) |
| `pipelines` | Hiring workflows attached to jobs (one pipeline per job) |
| `pipeline_rounds` | Configurable hiring stages within a pipeline (ordered, typed, with JSONB configuration) |
| `candidate_rounds` | Tracks individual candidate progress through each pipeline round |

### Pipeline Round Types

| Type | Purpose |
| --- | --- |
| `RESUME_SCREENING` | Initial resume review stage (default first round) |
| `ASSESSMENT` | Skill-based assessment round |
| `AI_INTERVIEW` | AI voice interview round |
| `MANUAL_REVIEW` | Recruiter manual review stage |

### Key Design Notes

- Pipeline is automatically created when a new job is created (default: "Resume Screening" round)
- Candidates are automatically enrolled in the first pipeline round upon application
- `applicants.status` tracks overall lifecycle: `Ready`, `Calling`, `Scheduled`, `Completed`, `Missed`
- `candidate_rounds.status` tracks per-round progress: `PENDING`, `ACTIVE`, `PASSED`, `FAILED`, `SKIPPED`
- Resume data (URL, public ID, extracted text, filename) is stored directly in `applicants`
- Interview data (transcript, summary, score, analysis JSONB) is stored directly in `applicants`

## Project Structure

```
recrutva/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/         # Recruiter dashboard (page, jobs, candidates, schedules)
│   │   └── jobs/[id]/         # Job-specific views (applications)
│   ├── (candidate)/
│   │   └── candidate-dashboard/
│   ├── actions/               # Server actions (jobs, candidates, pipeline, matching, etc.)
│   ├── api/
│   │   ├── ai/                # AI job description generation
│   │   ├── candidate/[id]/    # Candidate lookup API
│   │   ├── cron/              # Scheduled interview reminders
│   │   ├── interview/         # Question generation and interview evaluation
│   │   ├── tts/               # Text-to-speech streaming
│   │   └── upload/resume/     # Resume upload and text extraction
│   ├── interview/[id]/        # AI interview room and result view
│   ├── jobs/                  # Public job board and application pages
│   └── onboarding/            # Role selection after signup
├── components/                # App-specific components (modals, viewers)
│   └── ui/                    # shadcn/ui primitives
├── db/
│   ├── index.ts               # Neon + Drizzle database client
│   └── schema.ts              # All table definitions
├── drizzle/                   # Migration files
├── lib/
│   ├── ai.ts                  # Groq client and model configuration
│   ├── cloudinary.ts          # Cloudinary SDK config
│   ├── interview-email.ts     # Interview email builder and sender
│   └── utils.ts               # Utility functions
├── scripts/                   # Database migration and seed scripts
└── public/                    # Static assets
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="..."
CLERK_SECRET_KEY="..."

# Groq AI
GROQ_API_KEY="..."

# Cloudinary
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

# Email (Gmail App Password)
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Notes:**
- `DATABASE_URL` connects to your Neon PostgreSQL database
- `GROQ_API_KEY` is required for all AI features (matching, questions, evaluation, job generation)
- `CLOUDINARY_*` keys are required for resume file storage
- `EMAIL_USER` and `EMAIL_PASS` are used by Nodemailer for interview invitation and reminder emails
- `NEXT_PUBLIC_APP_URL` is used to generate interview and job links in emails
- Clerk keys are required for authentication and user sessions

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon PostgreSQL database
- Accounts for Clerk, Groq, Cloudinary, and Gmail (for email)

### Installation

```bash
git clone <repo-url>
cd recrutva
npm install
```

### Database Setup

Push the Drizzle schema to your database:

```bash
npm run db:push
```

Or inspect the database visually:

```bash
npm run db:studio
```

### Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

### Recruiter Flow

1. Sign in with Clerk and choose the "Hiring Manager" path during onboarding
2. Create a job (manually or with AI-generated description)
3. A hiring pipeline with a default "Resume Screening" round is automatically created
4. Candidates apply through the public job board or are added by the recruiter
5. Each candidate is automatically enrolled in the first pipeline round
6. AI calculates a match score by comparing the resume against the job description
7. An interview invitation email is sent to the candidate
8. Recruiter monitors candidates, manages schedules, and reviews completed interview results

### Candidate Flow

1. Browse open positions on the public job board
2. Open a job details page and submit an application with a resume (PDF/DOCX)
3. Resume is uploaded to Cloudinary and text is extracted for AI matching
4. Receive an interview invitation email with a link
5. Join the AI interview room, where Sarah AI asks 10 role-specific questions
6. Answer via speech recognition or manual text input
7. AI evaluates the transcript and produces a score, summary, and per-question breakdown
8. Track application status from the candidate dashboard

## AI Model Configuration

All AI features use models from the Groq API, configured centrally in `lib/ai.ts`:

| Feature | Model | Purpose |
| --- | --- | --- |
| Resume-Job Matching | `openai/gpt-oss-120b` | ATS match scoring (0-100) |
| Interview Questions | `qwen/qwen3.6-27b` | Generate 10 role-specific questions with blueprints |
| Interview Evaluation | `openai/gpt-oss-120b` | Score responses, generate summary and breakdown |
| Job Description Generation | `qwen/qwen3.6-27b` | Generate structured job descriptions |

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

### Utility Scripts

```bash
npx tsx scripts/push-migration.ts      # Direct SQL migration (workaround for connectivity issues)
npx tsx scripts/seed-test-pipeline.ts   # Seed test pipeline rounds for development
npx tsx scripts/verify-pipeline.ts      # Verify pipeline data in database
```

## Deployment

The project is configured for deployment on Vercel.

`vercel.json` includes a cron job for daily interview reminders:

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "46 10 * * *"
    }
  ]
}
```

Before deploying, configure all required environment variables in your Vercel project settings.

## Implemented

- Job CRUD with automatic pipeline creation
- Candidate application with resume upload (Cloudinary)
- PDF and DOCX text extraction from resumes
- AI resume-to-job match scoring (ATS score)
- Configurable hiring pipeline with ordered rounds
- Pipeline server actions (create, read, update order, delete rounds)
- Automatic candidate enrollment in first pipeline round
- AI interview question generation (10 questions with answer blueprints)
- AI interview completion with evaluation (score, summary, per-question breakdown)
- Interview room with speech-to-text and manual text input
- Google TTS voice playback for AI interviewer
- Interview invitation and daily reminder emails via Nodemailer
- Recruiter dashboard with metrics
- Candidate management with search and filtering
- Per-job applications page with match scores
- Public job board
- Candidate dashboard for application tracking
- Clerk authentication with job ownership verification

## Planned

- Multi-round candidate movement through pipeline stages
- Pipeline management UI (visual round configuration)
- Assessment round execution and scoring
- Manual review workflow for recruiters
- Pipeline progress visualization on candidate and recruiter views
- Resume skills parsing and structured data extraction
- Batch candidate import
- Interview scheduling integration
