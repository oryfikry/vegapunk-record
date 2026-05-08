import {
  chroma,
  documentForActivityLog,
  documentForKnowledgeItem,
  metadataForActivityLog,
  metadataForKnowledgeItem,
  normalizeKnowledgeCollection,
  type ChromaCollectionName,
  type ChromaGateway,
} from "../chroma";
import type { EmbeddingJob, VegapunkDatabase } from "../db";
import { markEmbeddingJobCompleted, markEmbeddingJobFailed, markEmbeddingJobProcessing } from "./queue";

export type ProcessEmbeddingJobsOptions = {
  chromaClient?: ChromaGateway;
  limit?: number;
  maxAttempts?: number;
};

export type ProcessEmbeddingJobsResult = {
  processed: number;
  completed: number;
  failed: number;
};

function resolveCollectionName(job: EmbeddingJob): ChromaCollectionName {
  if (job.activity_log_id) {
    return "activity_logs";
  }

  return normalizeKnowledgeCollection(job.collection);
}

async function upsertJob(db: VegapunkDatabase, client: ChromaGateway, job: EmbeddingJob): Promise<void> {
  const collectionName = resolveCollectionName(job);
  const collection = await client.getOrCreateCollection(collectionName);

  if (!collection) {
    throw new Error(`Chroma collection unavailable: ${collectionName}`);
  }

  if (job.knowledge_item_id) {
    const item = db.knowledge.getById(job.knowledge_item_id);

    if (!item) {
      throw new Error(`Knowledge item not found: ${job.knowledge_item_id}`);
    }

    await collection.upsert({
      ids: [item.id],
      documents: [documentForKnowledgeItem(item)],
      metadatas: [metadataForKnowledgeItem(item)],
    });
    return;
  }

  if (job.activity_log_id) {
    const activity = db.activities.getById(job.activity_log_id);

    if (!activity) {
      throw new Error(`Activity log not found: ${job.activity_log_id}`);
    }

    await collection.upsert({
      ids: [activity.id],
      documents: [documentForActivityLog(activity)],
      metadatas: [metadataForActivityLog(activity)],
    });
    return;
  }

  throw new Error(`Embedding job has no source row: ${job.id}`);
}

export async function processEmbeddingJobs(db: VegapunkDatabase, options: ProcessEmbeddingJobsOptions = {}): Promise<ProcessEmbeddingJobsResult> {
  const client = options.chromaClient ?? chroma;
  const maxAttempts = options.maxAttempts ?? 3;
  const retryableFailedJobs = db.embeddingJobs.listByStatus("failed").filter((job) => job.attempts < maxAttempts);
  const pendingJobs = [...db.embeddingJobs.listByStatus("pending"), ...retryableFailedJobs].slice(0, options.limit ?? Number.POSITIVE_INFINITY);
  const result: ProcessEmbeddingJobsResult = { processed: 0, completed: 0, failed: 0 };

  for (const pendingJob of pendingJobs) {
    const processingJob = markEmbeddingJobProcessing(db, pendingJob);
    result.processed += 1;

    try {
      await upsertJob(db, client, processingJob);
      markEmbeddingJobCompleted(db, processingJob);
      result.completed += 1;
    } catch (error) {
      markEmbeddingJobFailed(db, processingJob, error);
      result.failed += 1;
    }
  }

  return result;
}
