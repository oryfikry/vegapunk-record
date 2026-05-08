import { describe, expect, test } from "bun:test";
import { processEmbeddingJobs } from "../../src/indexing";
import type { ChromaCollection, ChromaGateway, ChromaRecordMetadata } from "../../src/chroma";
import { createTemporaryDatabase } from "./helpers";

function createRecordingChroma(): { client: ChromaGateway; upserts: { collection: string; ids: string[]; documents: string[]; metadatas: ChromaRecordMetadata[] }[] } {
  const upserts: { collection: string; ids: string[]; documents: string[]; metadatas: ChromaRecordMetadata[] }[] = [];
  const collections = new Map<string, ChromaCollection>();

  return {
    upserts,
    client: {
      async heartbeat() {
        return true;
      },
      async getOrCreateCollection(name) {
        const existing = collections.get(name);

        if (existing) {
          return existing;
        }

        const collection: ChromaCollection = {
          name,
          async upsert(args) {
            upserts.push({ collection: name, ids: args.ids, documents: args.documents, metadatas: args.metadatas });
          },
          async query() {
            return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
          },
        };
        collections.set(name, collection);
        return collection;
      },
    },
  };
}

describe("embedding job worker", () => {
  test("processes pending knowledge jobs into Chroma and marks completed", async () => {
    const db = createTemporaryDatabase();
    const activity = db.activities.create({ type: "message", level: "info", source: "test", message: "activity source" });
    const knowledge = db.knowledge.create({
      id: "knowledge-1",
      source_activity_ids: [activity.id],
      collection: "core_knowledge",
      title: "Luffy",
      content: "King of the Pirates",
    });
    const job = db.embeddingJobs.create({ knowledge_item_id: knowledge.id, collection: knowledge.collection, status: "pending" });
    const chroma = createRecordingChroma();

    const result = await processEmbeddingJobs(db, { chromaClient: chroma.client });

    expect(result).toEqual({ processed: 1, completed: 1, failed: 0 });
    expect(db.embeddingJobs.getById(job.id)).toMatchObject({ status: "completed", attempts: 0, last_error: null });
    expect(chroma.upserts).toHaveLength(1);
    expect(chroma.upserts[0]).toMatchObject({ collection: "core_knowledge", ids: ["knowledge-1"] });
    expect(chroma.upserts[0]?.metadatas[0]).toMatchObject({ sqlite_id: "knowledge-1", source_table: "knowledge_items" });
  });

  test("marks failed and increments attempts when Chroma upsert fails", async () => {
    const db = createTemporaryDatabase();
    const activity = db.activities.create({ id: "activity-1", type: "message", level: "info", source: "test", message: "searchable activity" });
    const job = db.embeddingJobs.create({ activity_log_id: activity.id, collection: "activity_logs", status: "pending" });
    const client: ChromaGateway = {
      async heartbeat() {
        return true;
      },
      async getOrCreateCollection() {
        return {
          name: "activity_logs",
          async upsert() {
            throw new Error("mock Chroma down");
          },
          async query() {
            return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
          },
        };
      },
    };

    const result = await processEmbeddingJobs(db, { chromaClient: client });

    expect(result).toEqual({ processed: 1, completed: 0, failed: 1 });
    expect(db.embeddingJobs.getById(job.id)).toMatchObject({ status: "failed", attempts: 1, last_error: "mock Chroma down" });
  });

  test("retries failed jobs while attempts remain under the max", async () => {
    const db = createTemporaryDatabase();
    const activity = db.activities.create({ type: "message", level: "info", source: "test", message: "retryable activity" });
    const job = db.embeddingJobs.create({ activity_log_id: activity.id, collection: "activity_logs", status: "failed", attempts: 1, last_error: "temporary outage" });
    const chroma = createRecordingChroma();

    const result = await processEmbeddingJobs(db, { chromaClient: chroma.client, maxAttempts: 3 });

    expect(result).toEqual({ processed: 1, completed: 1, failed: 0 });
    expect(db.embeddingJobs.getById(job.id)).toMatchObject({ status: "completed", attempts: 1 });
    expect(chroma.upserts).toHaveLength(1);
    expect(chroma.upserts[0]).toMatchObject({ collection: "activity_logs", ids: [activity.id] });
  });

  test("does not retry failed jobs that reached the max attempts", async () => {
    const db = createTemporaryDatabase();
    const activity = db.activities.create({ type: "message", level: "info", source: "test", message: "exhausted activity" });
    const job = db.embeddingJobs.create({ activity_log_id: activity.id, collection: "activity_logs", status: "failed", attempts: 3, last_error: "permanent outage" });
    const chroma = createRecordingChroma();

    const result = await processEmbeddingJobs(db, { chromaClient: chroma.client, maxAttempts: 3 });

    expect(result).toEqual({ processed: 0, completed: 0, failed: 0 });
    expect(db.embeddingJobs.getById(job.id)).toMatchObject({ status: "failed", attempts: 3, last_error: "permanent outage" });
    expect(chroma.upserts).toHaveLength(0);
  });
});
