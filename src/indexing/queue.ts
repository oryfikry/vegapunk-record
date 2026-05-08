import type { VegapunkDatabase, EmbeddingJob } from "../db";

export type CreateEmbeddingIndexJobInput = {
  knowledgeItemId?: string | null;
  activityLogId?: string | null;
  collection: string;
};

export function createEmbeddingJob(db: VegapunkDatabase, input: CreateEmbeddingIndexJobInput): EmbeddingJob {
  return db.embeddingJobs.create({
    knowledge_item_id: input.knowledgeItemId ?? null,
    activity_log_id: input.activityLogId ?? null,
    collection: input.collection,
    status: "pending",
  });
}

export function markEmbeddingJobProcessing(db: VegapunkDatabase, job: EmbeddingJob): EmbeddingJob {
  return db.embeddingJobs.update(job.id, {
    status: "processing",
    last_error: null,
  }) as EmbeddingJob;
}

export function markEmbeddingJobCompleted(db: VegapunkDatabase, job: EmbeddingJob): EmbeddingJob {
  return db.embeddingJobs.update(job.id, {
    status: "completed",
    last_error: null,
  }) as EmbeddingJob;
}

export function markEmbeddingJobFailed(db: VegapunkDatabase, job: EmbeddingJob, error: unknown): EmbeddingJob {
  const message = error instanceof Error ? error.message : String(error);

  return db.embeddingJobs.update(job.id, {
    status: "failed",
    attempts: job.attempts + 1,
    last_error: message,
  }) as EmbeddingJob;
}
