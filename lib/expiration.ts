/**
 * Expiration management for Recrutva jobs and candidate assessment/interview links.
 * 
 * Rules:
 * 1. Candidate Assessment/Interview links:
 *    - Valid for up to 48 hours after round activation / start (candidateRound.startedAt or candidateRound.createdAt).
 *    - In addition, cannot exceed the job expiration date (job.expiresAt).
 *    - Effective Link Expiry = min(startedAt + 48 hours, job.expiresAt).
 *
 * 2. Job Expiration Date (Recruiter Input):
 *    - Minimum allowed Job Expiry Date = Current Date + (Number of Pipeline Rounds * 2 days).
 *    - Each round takes 2 days (48 hours), so total job duration must be at least rounds * 2 days from now.
 */

export const ROUND_LINK_DURATION_HOURS = 48;
export const ROUND_LINK_DURATION_MS = ROUND_LINK_DURATION_HOURS * 60 * 60 * 1000;

/**
 * Calculates the minimum required job expiration date based on the number of rounds.
 * minDays = max(1, numRounds) * 2 days (48 hours per round).
 */
export function getMinimumJobExpiryDate(numRounds: number = 3, fromDate: Date = new Date()): Date {
  const rounds = Math.max(1, numRounds);
  const minDays = rounds * 2;
  return new Date(fromDate.getTime() + minDays * 24 * 60 * 60 * 1000);
}

/**
 * Validates recruiter-provided job expiration date against the minimum required duration.
 * Returns { valid: boolean, error?: string, effectiveExpiresAt: Date, minExpiryDate: Date }
 */
export function validateJobExpiryDate(
  expiresAtInput: Date | string | null | undefined,
  numRounds: number = 3,
  fromDate: Date = new Date()
): { valid: boolean; error?: string; effectiveExpiresAt: Date; minExpiryDate: Date } {
  const rounds = Math.max(1, numRounds);
  const minExpiryDate = getMinimumJobExpiryDate(rounds, fromDate);
  const minDays = rounds * 2;

  if (!expiresAtInput) {
    // Default to 30 days or minExpiryDate (whichever is larger)
    const defaultThirtyDays = new Date(fromDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const effectiveExpiresAt = defaultThirtyDays > minExpiryDate ? defaultThirtyDays : minExpiryDate;
    return {
      valid: true,
      effectiveExpiresAt,
      minExpiryDate,
    };
  }

  const userExpiresAt = typeof expiresAtInput === "string" ? new Date(expiresAtInput) : expiresAtInput;

  if (isNaN(userExpiresAt.getTime())) {
    return {
      valid: false,
      error: "Invalid job expiry date format.",
      effectiveExpiresAt: minExpiryDate,
      minExpiryDate,
    };
  }

  // Grace buffer of 5 minutes for latency/time drift during form submission
  const GRACE_BUFFER_MS = 5 * 60 * 1000;
  if (userExpiresAt.getTime() < minExpiryDate.getTime() - GRACE_BUFFER_MS) {
    const formattedMin = minExpiryDate.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return {
      valid: false,
      error: `Job expiry date must be at least ${minDays} days from now (${rounds} rounds × 2 days/round). Minimum required date: ${formattedMin}.`,
      effectiveExpiresAt: userExpiresAt,
      minExpiryDate,
    };
  }

  return {
    valid: true,
    effectiveExpiresAt: userExpiresAt,
    minExpiryDate,
  };
}

/**
 * Calculates the exact expiry timestamp for a candidate's round assessment link.
 * Link expires at: min(startedAt + 48 hours, job.expiresAt)
 */
export function getCandidateRoundLinkExpiry(params: {
  startedAt?: Date | string | null;
  createdAt?: Date | string | null;
  jobExpiresAt?: Date | string | null;
}): Date {
  const start = params.startedAt
    ? new Date(params.startedAt)
    : params.createdAt
    ? new Date(params.createdAt)
    : new Date();

  const roundExpiry = new Date(start.getTime() + ROUND_LINK_DURATION_MS);

  if (params.jobExpiresAt) {
    const jobExpiry = new Date(params.jobExpiresAt);
    if (!isNaN(jobExpiry.getTime()) && jobExpiry < roundExpiry) {
      return jobExpiry;
    }
  }

  return roundExpiry;
}

/**
 * Checks whether a candidate's assessment/interview link is currently expired.
 */
export function isRoundLinkExpired(params: {
  startedAt?: Date | string | null;
  createdAt?: Date | string | null;
  jobExpiresAt?: Date | string | null;
  jobStatus?: string | null;
  now?: Date;
}): { isExpired: boolean; reason?: string; expiresAt: Date; remainingMs: number } {
  const now = params.now || new Date();
  const linkExpiry = getCandidateRoundLinkExpiry(params);
  const remainingMs = linkExpiry.getTime() - now.getTime();

  if (params.jobStatus === "CLOSED") {
    return {
      isExpired: true,
      reason: "JOB_CLOSED",
      expiresAt: linkExpiry,
      remainingMs: 0,
    };
  }

  if (params.jobExpiresAt) {
    const jobExpiry = new Date(params.jobExpiresAt);
    if (!isNaN(jobExpiry.getTime()) && now > jobExpiry) {
      return {
        isExpired: true,
        reason: "JOB_EXPIRED",
        expiresAt: jobExpiry,
        remainingMs: 0,
      };
    }
  }

  if (remainingMs <= 0) {
    return {
      isExpired: true,
      reason: "ROUND_LINK_EXPIRED_48H",
      expiresAt: linkExpiry,
      remainingMs: 0,
    };
  }

  return {
    isExpired: false,
    expiresAt: linkExpiry,
    remainingMs,
  };
}
