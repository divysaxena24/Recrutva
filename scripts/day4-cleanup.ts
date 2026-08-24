import { db } from "../db";
import { applicants, candidateRounds, pipelines } from "../db/schema";
import { eq } from "drizzle-orm";

async function cleanup() {
  // Remove test candidates created during previous run
  const deletedCR = await db.delete(candidateRounds).where(
    eq(candidateRounds.candidateId, 14)
  );
  console.log(`Removed ${deletedCR.rowCount || 0} candidate rounds for candidate #14`);

  const deletedCandidate = await db.delete(applicants).where(eq(applicants.id, 14));
  console.log(`Removed candidate #14 (${deletedCandidate.rowCount || 0} rows)`);

  // Remove test pipeline #2 if it exists
  const deletedPipeline = await db.delete(pipelines).where(eq(pipelines.id, 2));
  console.log(`Removed pipeline #2 (${deletedPipeline.rowCount || 0} rows)`);

  console.log("Cleanup complete");
}

cleanup().catch(console.error);
