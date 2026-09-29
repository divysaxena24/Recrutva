/**
 * Seed script — Real Indian candidate & job data
 *
 * Clears all jobs, applicants, pipelines, candidate_rounds, schedules, schedule_logs
 * then inserts:
 *   - 5 realistic Indian tech jobs (PUBLISHED) with proper JDs
 *   - 10 candidates with real Indian names, all using Divya Saxena's resume
 *     and divsaxena2402@gmail.com email
 *
 * Usage: npx tsx scripts/seed-real-data.ts
 */

import { config } from "dotenv";
config({ path: ".env" });

import { neon } from "@neondatabase/serverless";
import { configureNeonHttp } from "../lib/neon-fetch";

configureNeonHttp();

const sql = neon(process.env.DATABASE_URL!);

// ─── Resume text extracted from docs/DIVYA_RESUME_SDE.pdf ─────────────────────

const RESUME_TEXT = `DIVYA SAXENA
Phone: 7024296567 | Email: divsaxena2402@gmail.com | LinkedIn: divysaxena24 | GitHub: divysaxena24 | Portfolio

EDUCATION
SRM University, AP                                                              Aug 2024 – May 2028
B.Tech in Computer Science Engineering, CGPA: 9.25/10                          Amaravati, AP

EXPERIENCE
Research Intern – Parallel Computing & Graph Algorithms                         May 2026 – July 2026
International Institute of Information Technology Hyderabad (IIITH)             Hyderabad, India
• Optimized BFS-based triangle counting on large-scale graphs using OpenMP and edge-level parallelism,
  achieving 6x speedup (900ms → 150ms) on the SNAP ego-Facebook dataset with 88K nodes and 1.3M edges.
• Implemented horizontal edge filtering to reduce thread synchronization overhead, improving scalability
  across 8+ CPU cores while minimizing lock contention and cache-coherency overhead.
• Developed and documented parallel algorithm optimizations, performance benchmarks, and scalability
  analysis under the supervision of Prof. Kishore Kothapalli, Dean of Academics.

AI Automation and Web Development Intern                                        Feb 2026 – Apr 2026
PIVOT Automations                                                                Remote
• Built 20+ n8n automation workflows reducing manual process time by 40% across client ticket routing,
  document processing, and email automation pipelines.
• Designed and deployed REST APIs supporting 1,000+ monthly automated executions with fault tolerance,
  retry mechanisms, asynchronous notifications, and error handling.
• Integrated 3+ third-party SaaS platforms including Slack, Google Workspace, and ticketing systems using
  custom JavaScript handlers, improving data consistency and reducing human error by 95%.

TECHNICAL PROJECTS
Recrutva - Hiring Platform | GitHub | Live
• Architected a full-stack hiring platform using Next.js, TypeScript, Node.js, PostgreSQL, and Redis to
  end candidate workflows from resume screening to interview evaluation.
• Engineered backend services for resume matching, skill assessment, and voice interviews, integrating
  external APIs with asynchronous processing, structured data pipelines, and persistent application state.
• Improved backend reliability and scalability using Redis rate limiting (100 req/sec), database indexing for
  500+ concurrent users, automated E2E testing (95% coverage), and GitHub Actions CI/CD.

Briefly - Personal Productivity Assistant | GitHub | Live
• Built a full-stack productivity assistant using Next.js, TypeScript, and Node.js, integrating Gmail,
  Google Calendar, Google Drive, GitHub, Discord, and Telegram through OAuth 2.0 and REST APIs.
• Architected a multi-service orchestration engine handling concurrent API requests, response aggregation,
  error isolation, and state management across 6+ external services using PostgreSQL, Drizzle ORM, and async/await.
• Implemented automated integration and E2E testing, containerized the application with Docker, and configured
  GitHub Actions CI/CD for automated testing, builds, and deployment.

JobClarity - Job Fraud Detection Platform | GitHub | Live
• Developed a FastAPI REST microservice for real-time job classification using an XGBoost model trained
  on 17,880+ job postings, achieving an 82% F1-score through feature engineering and hyperparameter tuning.
• Built an end-to-end ML pipeline using Python, Pandas, NumPy, scikit-learn, XGBoost, and MLflow, with SHAP
  for model interpretability and experiment tracking.
• Integrated the inference service with a Next.js frontend through REST APIs, implementing Docker
  containerization, inference caching, and GitHub Actions CI/CD for automated testing and deployment.

SKILLS
• Languages: Java (Primary), TypeScript, JavaScript, Python
• Frameworks: React.js, Next.js, Node.js, Express.js, FastAPI
• Backend & Databases: REST APIs, PostgreSQL, MongoDB, MySQL, Redis, Drizzle ORM, OAuth 2.0
• Cloud & DevOps: Docker, AWS (EC2, S3), GitHub Actions (CI/CD), Vercel
• Testing & Tools: Vitest, Integration Testing, E2E Testing, Git, GitHub, Linux, Postman
• AI/ML: scikit-learn, XGBoost, MLflow, SHAP, Feature Engineering
• Core CS: Data Structures & Algorithms (Java), OOP, Operating Systems, DBMS, Computer Networks, Parallel Computing

ACHIEVEMENTS
• LeetCode - Solved 355+ problems across Arrays, Linked Lists, Trees, Graphs, and Dynamic Programming.
• Open Source - Contributed 45+ pull requests, with 18+ merged, across 5+ repositories through GSSoC and OSCI.
• Smart India Hackathon 2025 - Cleared internal rounds, finishing among the Top 45 teams out of 600+ teams.
• Reckon 7.0 Hackathon - Secured Runner-Up in the Simpli AI track for developing an AI-driven solution.`;

// ─── Recruiter userId — pulled from Clerk session (must exist in users table) ──

async function getRecruiterUserId(): Promise<string> {
  // 1. Prioritize primary recruiter email divysaxena2402@gmail.com / divsaxena2402@gmail.com
  let rows = await sql.query(
    `SELECT clerk_id FROM users WHERE email IN ('divysaxena2402@gmail.com', 'divsaxena2402@gmail.com') OR email LIKE '%divysaxena%' LIMIT 1`
  );
  if (rows.length > 0) {
    const clerkId = rows[0].clerk_id as string;
    await sql.query(
      `UPDATE users SET role = 'RECRUITER' WHERE clerk_id = $1`,
      [clerkId]
    );
    console.log(`  ✓ Found recruiter account (${clerkId}), set role = RECRUITER`);
    return clerkId;
  }

  // 2. Try by role enum value
  rows = await sql.query(
    `SELECT clerk_id FROM users WHERE role::text = 'RECRUITER' LIMIT 1`
  );
  if (rows.length > 0) return rows[0].clerk_id as string;

  // 3. Fall back: pick any user (usually the only user is the recruiter)
  rows = await sql.query(`SELECT clerk_id FROM users LIMIT 1`);
  if (rows.length > 0) {
    console.log("  ⚠ No RECRUITER role found — using first available user.");
    return rows[0].clerk_id as string;
  }

  throw new Error("No users found in the users table. Please sign in via the app first.");
}

// ─── Job definitions ───────────────────────────────────────────────────────────

function getJobs(recruiterId: string) {
  const now = new Date();
  const expires30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expires45 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const expires60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  return [
    {
      userId: recruiterId,
      title: "Software Development Engineer – Full Stack",
      description: `We are looking for a passionate Software Development Engineer to join our growing engineering team. You will design and build scalable web applications using modern full-stack technologies.

## About the Role
As an SDE, you will work closely with product managers, designers, and senior engineers to ship high-quality features end-to-end — from database schema to pixel-perfect UI.

## Responsibilities
- Design and develop robust RESTful APIs using Node.js and TypeScript
- Build responsive, high-performance React/Next.js frontends
- Design and optimise PostgreSQL schemas, queries, and indexes
- Write comprehensive unit, integration, and E2E tests (>80% coverage)
- Participate in code reviews and architecture discussions
- Deploy and monitor services on AWS using GitHub Actions CI/CD
- Collaborate in an Agile sprint environment

## Requirements
- Strong proficiency in TypeScript / JavaScript
- Hands-on experience with React.js, Next.js, and Node.js
- Solid understanding of PostgreSQL and Redis
- Familiarity with Docker and AWS (EC2, S3)
- Good understanding of DSA and system design fundamentals
- 0–2 years of experience (Freshers welcome)`,
      requirements: "TypeScript, React.js, Next.js, Node.js, PostgreSQL, Redis, Docker, AWS",
      location: "Bengaluru, Karnataka",
      status: "PUBLISHED",
      department: "Engineering",
      employmentType: "Full-time",
      experience: "0–2 years",
      workMode: "Hybrid",
      salaryRange: "₹8–14 LPA",
      summary: "Build scalable full-stack applications using Next.js, Node.js and PostgreSQL in a fast-paced product team.",
      responsibilities: JSON.stringify([
        "Design and develop RESTful APIs using Node.js and TypeScript",
        "Build responsive frontends with React.js and Next.js",
        "Optimise PostgreSQL schemas and write complex queries",
        "Write unit, integration, and E2E tests with >80% coverage",
        "Deploy services on AWS using GitHub Actions CI/CD",
        "Participate in architecture discussions and code reviews"
      ]),
      requiredSkills: JSON.stringify(["TypeScript", "React.js", "Next.js", "Node.js", "PostgreSQL", "REST APIs", "Git"]),
      preferredSkills: JSON.stringify(["Redis", "Docker", "AWS", "Drizzle ORM", "Vitest"]),
      qualifications: JSON.stringify([
        "B.Tech / B.E. in Computer Science or related field",
        "Strong fundamentals in DSA (preferably Java or TypeScript)",
        "Experience building and deploying full-stack projects"
      ]),
      benefits: JSON.stringify([
        "Competitive salary (₹8–14 LPA)",
        "Health insurance for self + family",
        "Flexible hybrid work schedule",
        "Annual learning budget of ₹50,000",
        "Equity options after 1 year"
      ]),
      expiresAt: expires30,
    },
    {
      userId: recruiterId,
      title: "Backend Engineer – Node.js & Microservices",
      description: `Join our platform team to architect and scale the backend infrastructure that powers millions of daily transactions. You'll work on high-throughput APIs, message queues, and distributed systems.

## About the Role
We are building a next-generation fintech platform and need strong backend engineers who love working close to the metal — databases, queues, caches, and distributed systems.

## Responsibilities
- Design microservices using Node.js / Express.js / Fastify
- Build and maintain event-driven pipelines with Kafka and RabbitMQ
- Implement caching strategies with Redis
- Manage PostgreSQL and MongoDB databases at scale
- Write Infrastructure as Code using Terraform and AWS CDK
- Ensure 99.9% uptime through robust observability (Datadog, Sentry)

## Requirements
- 1–3 years of backend development experience
- Expert knowledge of Node.js and TypeScript
- Experience with message queues (Kafka / RabbitMQ)
- Deep understanding of REST and gRPC API design
- PostgreSQL / MongoDB at production scale`,
      requirements: "Node.js, TypeScript, PostgreSQL, Redis, Kafka, Docker, AWS",
      location: "Hyderabad, Telangana",
      status: "PUBLISHED",
      department: "Platform Engineering",
      employmentType: "Full-time",
      experience: "1–3 years",
      workMode: "Remote",
      salaryRange: "₹12–20 LPA",
      summary: "Scale our fintech backend using Node.js microservices, Kafka, and PostgreSQL with Redis caching.",
      responsibilities: JSON.stringify([
        "Design and scale Node.js microservices for high-throughput workloads",
        "Build event-driven pipelines using Kafka and RabbitMQ",
        "Implement Redis caching and session management",
        "Optimise PostgreSQL and MongoDB queries for production loads",
        "Write Infrastructure as Code using Terraform and AWS CDK",
        "Monitor services via Datadog dashboards and Sentry alerts"
      ]),
      requiredSkills: JSON.stringify(["Node.js", "TypeScript", "PostgreSQL", "Redis", "REST APIs", "Docker"]),
      preferredSkills: JSON.stringify(["Kafka", "MongoDB", "AWS", "Terraform", "Fastify", "gRPC"]),
      qualifications: JSON.stringify([
        "B.Tech in CS / IT or equivalent",
        "1+ years of production Node.js experience",
        "Demonstrated experience with distributed systems"
      ]),
      benefits: JSON.stringify([
        "Remote-first work culture",
        "₹12–20 LPA + performance bonus",
        "Medical, dental & vision insurance",
        "WFH stipend of ₹20,000 on joining",
        "Quarterly team offsites"
      ]),
      expiresAt: expires45,
    },
    {
      userId: recruiterId,
      title: "Frontend Engineer – React & Next.js",
      description: `We're looking for a creative frontend engineer to craft delightful user interfaces that are fast, accessible, and beautiful. You will own the frontend of our consumer-facing product used by 2M+ users.

## About the Role
You'll be part of the product engineering squad building the next version of our design system and consumer app.

## Responsibilities
- Build pixel-perfect UIs from Figma designs using React.js and Next.js
- Optimise Core Web Vitals (LCP < 1.5s, CLS < 0.1)
- Maintain and extend our component library with Storybook
- Implement micro-animations using Framer Motion
- Integrate REST APIs and manage state with Zustand / TanStack Query
- Write accessibility-compliant (WCAG 2.1 AA) components
- Collaborate with UX designers and participate in design reviews

## Requirements
- 1–3 years of React.js / Next.js experience
- Strong CSS / Tailwind CSS skills
- Performance optimisation experience (code splitting, lazy loading, ISR)
- Knowledge of TypeScript and modern JS (ES2022+)
- Eye for detail and strong design sensibility`,
      requirements: "React.js, Next.js, TypeScript, CSS, Figma, REST APIs",
      location: "Pune, Maharashtra",
      status: "PUBLISHED",
      department: "Product Engineering",
      employmentType: "Full-time",
      experience: "1–3 years",
      workMode: "Hybrid",
      salaryRange: "₹10–18 LPA",
      summary: "Craft fast and accessible React/Next.js UIs for 2M+ users with a strong focus on performance and design.",
      responsibilities: JSON.stringify([
        "Build pixel-perfect UIs from Figma designs using React.js and Next.js",
        "Optimise Core Web Vitals and page performance",
        "Maintain component library using Storybook",
        "Implement animations and transitions using Framer Motion",
        "Integrate REST APIs and manage state with Zustand / TanStack Query",
        "Ensure WCAG 2.1 AA accessibility compliance"
      ]),
      requiredSkills: JSON.stringify(["React.js", "Next.js", "TypeScript", "CSS", "REST APIs", "Git"]),
      preferredSkills: JSON.stringify(["Tailwind CSS", "Framer Motion", "Storybook", "Figma", "Vitest", "Zustand"]),
      qualifications: JSON.stringify([
        "B.Tech / B.Sc in CS or related field",
        "Strong portfolio of React/Next.js projects",
        "Experience with performance profiling tools (Lighthouse, WebPageTest)"
      ]),
      benefits: JSON.stringify([
        "₹10–18 LPA based on experience",
        "Flexible hybrid — 3 days office, 2 remote",
        "Comprehensive health coverage",
        "Annual team retreats",
        "₹30,000 annual gadget allowance"
      ]),
      expiresAt: expires30,
    },
    {
      userId: recruiterId,
      title: "ML Engineer – NLP & Production AI Systems",
      description: `Join our AI/ML team to productionise machine learning models at scale. You will work across the full ML lifecycle — from exploratory data analysis and model training to production deployment and monitoring.

## About the Role
Our team builds AI features that are used by 500K+ daily active users. You'll own the end-to-end ML workflow for our NLP and recommendation systems.

## Responsibilities
- Train, evaluate, and deploy NLP models (transformers, XGBoost, LightGBM)
- Build ML pipelines using MLflow, Airflow, and Kubeflow
- Serve models via FastAPI microservices with Triton / TorchServe
- Monitor model performance and implement drift detection
- Collaborate with data engineers on feature stores (Feast / Tecton)
- Write SHAP-based explainability reports for model decisions
- A/B test new models against production baseline

## Requirements
- 1–3 years of ML engineering or data science experience
- Proficiency in Python, PyTorch / TensorFlow, and scikit-learn
- Experience deploying ML models to production
- Familiarity with Docker, Kubernetes, and cloud ML platforms (AWS SageMaker)`,
      requirements: "Python, scikit-learn, XGBoost, FastAPI, MLflow, Docker, AWS SageMaker",
      location: "Bengaluru, Karnataka",
      status: "PUBLISHED",
      department: "AI / ML",
      employmentType: "Full-time",
      experience: "1–3 years",
      workMode: "Hybrid",
      salaryRange: "₹15–25 LPA",
      summary: "Productionise NLP models and build end-to-end ML pipelines serving 500K+ daily active users.",
      responsibilities: JSON.stringify([
        "Train, evaluate, and deploy NLP and classification models",
        "Build ML pipelines with MLflow, Airflow, and Kubeflow",
        "Serve models via FastAPI microservices at production scale",
        "Monitor model drift and implement retraining triggers",
        "Collaborate with data engineers on feature stores",
        "Write SHAP-based model explainability reports"
      ]),
      requiredSkills: JSON.stringify(["Python", "scikit-learn", "XGBoost", "FastAPI", "MLflow", "Docker"]),
      preferredSkills: JSON.stringify(["PyTorch", "AWS SageMaker", "Kubeflow", "SHAP", "Triton", "Feast"]),
      qualifications: JSON.stringify([
        "B.Tech / M.Tech in CS, Statistics, or related field",
        "Published ML projects or Kaggle competition experience",
        "Experience with model deployment in production environments"
      ]),
      benefits: JSON.stringify([
        "₹15–25 LPA + ESOPs",
        "Remote-friendly (2 days/week in office)",
        "Premium health insurance",
        "Access to GPU clusters for research",
        "₹1 lakh annual conference budget"
      ]),
      expiresAt: expires60,
    },
    {
      userId: recruiterId,
      title: "DevOps Engineer – AWS & Kubernetes",
      description: `We are looking for a DevOps engineer to own our cloud infrastructure, observability stack, and deployment pipelines. You will work with our engineering teams to improve developer velocity and system reliability.

## About the Role
You'll be responsible for the infrastructure that runs our multi-tenant SaaS platform on AWS EKS, ensuring 99.95% uptime and fast release cycles.

## Responsibilities
- Manage and scale AWS EKS clusters and infrastructure
- Build and maintain GitHub Actions CI/CD pipelines
- Write Terraform modules for infrastructure provisioning
- Configure Prometheus / Grafana dashboards and alerting
- Manage secrets, IAM policies, and security baselines
- Implement SRE practices: SLOs, SLAs, error budgets, runbooks
- Containerise applications using Docker and Helm charts
- Conduct root cause analysis for incidents and drive postmortems

## Requirements
- 1–4 years of DevOps / SRE experience
- Expertise in AWS (EKS, EC2, S3, RDS, CloudFront, Route53)
- Hands-on Kubernetes administration and Helm
- Terraform for Infrastructure as Code
- Strong scripting skills in Bash and Python
- Experience with Prometheus, Grafana, and PagerDuty`,
      requirements: "AWS, Kubernetes, Terraform, Docker, GitHub Actions, Prometheus, Grafana",
      location: "Noida, Uttar Pradesh",
      status: "PUBLISHED",
      department: "Infrastructure",
      employmentType: "Full-time",
      experience: "1–4 years",
      workMode: "Hybrid",
      salaryRange: "₹12–22 LPA",
      summary: "Own AWS EKS infrastructure and CI/CD pipelines ensuring 99.95% uptime for our multi-tenant SaaS platform.",
      responsibilities: JSON.stringify([
        "Manage and scale AWS EKS clusters and cloud infrastructure",
        "Build and maintain GitHub Actions CI/CD pipelines",
        "Write Terraform modules for infrastructure provisioning",
        "Configure Prometheus / Grafana monitoring and alerting",
        "Manage secrets, IAM policies, and security baselines",
        "Implement SRE practices: SLOs, error budgets, and runbooks"
      ]),
      requiredSkills: JSON.stringify(["AWS", "Kubernetes", "Terraform", "Docker", "GitHub Actions", "Linux"]),
      preferredSkills: JSON.stringify(["Helm", "Prometheus", "Grafana", "Python", "Bash", "PagerDuty"]),
      qualifications: JSON.stringify([
        "B.Tech in CS / IT or equivalent",
        "AWS Certified DevOps Engineer (Professional) preferred",
        "Experience managing production Kubernetes clusters"
      ]),
      benefits: JSON.stringify([
        "₹12–22 LPA based on experience",
        "On-call allowance + incident bonuses",
        "Comprehensive health + term life insurance",
        "AWS certification reimbursement",
        "Home office setup budget of ₹25,000"
      ]),
      expiresAt: expires45,
    },
  ];
}

// ─── Candidate definitions ─────────────────────────────────────────────────────

function getCandidates(recruiterId: string, jobIdMap: Record<number, number>) {
  // jobIdMap: index → actual db id  (0-4 corresponding to jobs above)
  const email = "divsaxena2402@gmail.com";
  const phone = "7024296567";
  const resumeUrl = null;

  return [
    // Job 0: Full Stack SDE — 4 candidates
    {
      userId: recruiterId,
      targetJobId: jobIdMap[0],
      jobTitle: "Software Development Engineer – Full Stack",
      name: "Aarav Mehta",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "88",
      score: null,
    },
    {
      userId: recruiterId,
      targetJobId: jobIdMap[0],
      jobTitle: "Software Development Engineer – Full Stack",
      name: "Priya Sharma",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "82",
      score: null,
    },
    {
      userId: recruiterId,
      targetJobId: jobIdMap[0],
      jobTitle: "Software Development Engineer – Full Stack",
      name: "Rohan Gupta",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Completed",
      matchScore: "91",
      score: "85",
      summary: "Strong full-stack candidate with hands-on Next.js and PostgreSQL experience through the Recrutva project. Demonstrated CI/CD and testing discipline. Recommended for next round.",
    },
    // Job 1: Backend Engineer — 2 candidates
    {
      userId: recruiterId,
      targetJobId: jobIdMap[1],
      jobTitle: "Backend Engineer – Node.js & Microservices",
      name: "Sneha Patel",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "79",
      score: null,
    },
    {
      userId: recruiterId,
      targetJobId: jobIdMap[1],
      jobTitle: "Backend Engineer – Node.js & Microservices",
      name: "Karthik Rajan",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Completed",
      matchScore: "86",
      score: "78",
      summary: "Solid backend skills with REST API and Redis experience. IIIT Hyderabad parallel computing research shows strong CS fundamentals. Consider for second round discussion on microservices architecture.",
    },
    // Job 2: Frontend Engineer — 2 candidates
    {
      userId: recruiterId,
      targetJobId: jobIdMap[2],
      jobTitle: "Frontend Engineer – React & Next.js",
      name: "Nisha Iyer",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "84",
      score: null,
    },
    {
      userId: recruiterId,
      targetJobId: jobIdMap[2],
      jobTitle: "Frontend Engineer – React & Next.js",
      name: "Vikram Singh",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "77",
      score: null,
    },
    // Job 3: ML Engineer — 2 candidates
    {
      userId: recruiterId,
      targetJobId: jobIdMap[3],
      jobTitle: "ML Engineer – NLP & Production AI Systems",
      name: "Ananya Krishnan",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Completed",
      matchScore: "89",
      score: "82",
      summary: "Excellent ML background — JobClarity project with FastAPI + XGBoost achieving 82% F1-score is directly relevant. Python, MLflow, SHAP, and scikit-learn proficiency confirmed. Strong hire signal.",
    },
    // Job 4: DevOps — 1 candidate
    {
      userId: recruiterId,
      targetJobId: jobIdMap[4],
      jobTitle: "DevOps Engineer – AWS & Kubernetes",
      name: "Rahul Verma",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "71",
      score: null,
    },
    // Additional candidate for job 0
    {
      userId: recruiterId,
      targetJobId: jobIdMap[0],
      jobTitle: "Software Development Engineer – Full Stack",
      name: "Tanvi Joshi",
      email,
      phone,
      resumeText: RESUME_TEXT,
      status: "Ready",
      matchScore: "80",
      score: null,
    },
  ];
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(60));
  console.log("  Recrutva — Real Data Seed Script");
  console.log("═".repeat(60));

  // 1. Get recruiter
  console.log("\n[1/5] Fetching recruiter user ID...");
  const recruiterId = await getRecruiterUserId();
  console.log(`  ✓ Recruiter: ${recruiterId}`);

  // 2. Wipe existing data (cascade order: schedule_logs → schedules → candidate_rounds → pipeline_rounds → pipelines → applicants → jobs)
  console.log("\n[2/5] Clearing existing data...");
  await sql.query(`DELETE FROM "schedule_logs"`);
  await sql.query(`DELETE FROM "schedules"`);
  await sql.query(`DELETE FROM "candidate_rounds"`);
  await sql.query(`DELETE FROM "pipeline_rounds"`);
  await sql.query(`DELETE FROM "pipelines"`);
  await sql.query(`DELETE FROM "applicants"`);
  await sql.query(`DELETE FROM "jobs"`);
  console.log("  ✓ All jobs, candidates, pipelines, and schedules cleared.");

  // 3. Insert jobs
  console.log("\n[3/5] Inserting 5 real job postings...");
  const jobs = getJobs(recruiterId);
  const insertedJobIds: number[] = [];

  for (const job of jobs) {
    const rows = await sql.query(
      `INSERT INTO "jobs" (
        user_id, title, description, requirements, location, status,
        department, employment_type, experience, work_mode, salary_range,
        summary, responsibilities, required_skills, preferred_skills,
        qualifications, benefits, expires_at, updated_at, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,$15,
        $16,$17,$18,NOW(),NOW()
      ) RETURNING id`,
      [
        job.userId, job.title, job.description, job.requirements, job.location, job.status,
        job.department, job.employmentType, job.experience, job.workMode, job.salaryRange,
        job.summary,
        job.responsibilities, job.requiredSkills, job.preferredSkills,
        job.qualifications, job.benefits,
        job.expiresAt.toISOString(),
      ]
    );
    const jobId = (rows[0] as { id: number }).id;
    insertedJobIds.push(jobId);
    console.log(`  ✓ Job "${job.title}" — ID ${jobId}`);
  }

  // Build index → db id map
  const jobIdMap: Record<number, number> = {};
  insertedJobIds.forEach((id, i) => { jobIdMap[i] = id; });

  // 4. Insert candidates
  console.log("\n[4/5] Inserting 10 candidates...");
  const candidates = getCandidates(recruiterId, jobIdMap);

  for (const c of candidates) {
    const rows = await sql.query(
      `INSERT INTO "applicants" (
        user_id, target_job_id, job_title, name, email, phone,
        resume_text, resume_url, status, score, match_score, summary, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,NOW()
      ) RETURNING id`,
      [
        c.userId, c.targetJobId, c.jobTitle, c.name, c.email, c.phone,
        c.resumeText, null, c.status,
        (c as Record<string, unknown>).score ?? null,
        c.matchScore,
        (c as Record<string, unknown>).summary ?? null,
      ]
    );
    const cId = (rows[0] as { id: number }).id;
    console.log(`  ✓ Candidate "${c.name}" for "${c.jobTitle}" — ID ${cId}`);
  }

  // 5. Summary
  console.log("\n[5/5] Seed complete!");
  console.log("═".repeat(60));
  console.log(`  Jobs inserted   : ${insertedJobIds.length}`);
  console.log(`  Candidates added: ${candidates.length}`);
  console.log(`  Email used      : divsaxena2402@gmail.com`);
  console.log(`  Resume          : Divya Saxena – SRM University AP, IIITH Research Intern`);
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
