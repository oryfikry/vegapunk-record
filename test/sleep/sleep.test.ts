import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type VegapunkDatabase } from "../../src/db";
import { CORE_KNOWLEDGE_COLLECTION, EPHEMERAL_MEMORY_COLLECTION, runSleepRoutine } from "../../src/memory";

const cleanupPaths: string[] = [];
const openDatabases: VegapunkDatabase[] = [];

function createTemporaryDatabase(): VegapunkDatabase {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-sleep-"));
  cleanupPaths.push(directory);
  const db = createDatabase(join(directory, "test.sqlite"));
  openDatabases.push(db);
  return db;
}

afterEach(() => {
  for (const db of openDatabases.splice(0)) {
    db.close();
  }

  for (const path of cleanupPaths.splice(0)) {
    try {
      rmSync(path, { recursive: true, force: true });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("EBUSY")) {
        throw error;
      }
    }
  }
});

describe("sleep routine", () => {
  test("exits gracefully when there are no eligible activity logs", async () => {
    const db = createTemporaryDatabase();

    const result = await runSleepRoutine(db, { now: new Date("2026-05-08T12:00:00.000Z") });

    expect(result).toMatchObject({
      ok: true,
      message: "No eligible activity logs to summarize.",
      eligibleActivities: 0,
      createdSummaries: [],
    });
    expect(db.knowledge.list(CORE_KNOWLEDGE_COLLECTION)).toHaveLength(0);
    expect(db.embeddingJobs.listByStatus("pending")).toHaveLength(0);
  });

  test("creates deterministic core knowledge summaries and queues embedding jobs", async () => {
    const db = createTemporaryDatabase();
    const now = new Date("2026-05-08T12:00:00.000Z");
    const first = db.activities.create({
      id: "activity-alpha",
      timestamp: "2026-05-08T08:00:00.000Z",
      agent_id: "stella",
      type: "message",
      level: "info",
      source: "test",
      message: "Stella learned that Shaka completed the Chroma indexing pass.",
    });
    const second = db.activities.create({
      id: "activity-beta",
      timestamp: "2026-05-08T09:00:00.000Z",
      agent_id: "stella",
      type: "task_update",
      level: "info",
      source: "test",
      message: "Nightly memory should avoid duplicate summaries.",
    });

    const result = await runSleepRoutine(db, { now });
    const knowledge = db.knowledge.list(CORE_KNOWLEDGE_COLLECTION);
    const jobs = db.embeddingJobs.listByStatus("pending");

    expect(result.createdSummaries).toHaveLength(1);
    expect(result.createdSummaries[0]?.sourceActivityIds).toEqual([first.id, second.id]);
    expect(knowledge).toHaveLength(1);
    expect(knowledge[0]).toMatchObject({ collection: CORE_KNOWLEDGE_COLLECTION });
    expect(knowledge[0]?.content).toContain("mock:");
    expect(JSON.parse(knowledge[0]?.metadata_json ?? "{}")).toMatchObject({
      kind: "sleep_summary",
      source_agent_id: "stella",
      source_activity_ids: [first.id, second.id],
      summarizer_provider: "mock",
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ knowledge_item_id: knowledge[0]?.id, collection: CORE_KNOWLEDGE_COLLECTION, status: "pending" });
  });

  test("does not duplicate summaries for the same source set on rerun", async () => {
    const db = createTemporaryDatabase();
    const now = new Date("2026-05-08T12:00:00.000Z");
    db.activities.create({
      id: "activity-once",
      timestamp: "2026-05-08T07:00:00.000Z",
      agent_id: "lilith",
      type: "thought",
      level: "info",
      source: "test",
      message: "Lilith observed a stable task handoff.",
    });

    const firstRun = await runSleepRoutine(db, { now });
    const secondRun = await runSleepRoutine(db, { now });

    expect(firstRun.createdSummaries).toHaveLength(1);
    expect(secondRun.createdSummaries).toHaveLength(0);
    expect(secondRun.eligibleActivities).toBe(0);
    expect(db.knowledge.list(CORE_KNOWLEDGE_COLLECTION)).toHaveLength(1);
    expect(db.embeddingJobs.listByStatus("pending")).toHaveLength(1);
  });

  test("optionally flushes only ephemeral derived memory", async () => {
    const db = createTemporaryDatabase();
    const canonicalActivity = db.activities.create({
      id: "canonical-activity",
      timestamp: "2026-05-08T06:00:00.000Z",
      agent_id: "shaka",
      type: "message",
      level: "info",
      source: "test",
      message: "Canonical activity logs must remain after ephemeral flush.",
    });
    const ephemeral = db.knowledge.create({
      collection: EPHEMERAL_MEMORY_COLLECTION,
      title: "Derived scratch",
      content: "Safe to flush",
    });
    db.embeddingJobs.create({ knowledge_item_id: ephemeral.id, collection: EPHEMERAL_MEMORY_COLLECTION, status: "pending" });

    const result = await runSleepRoutine(db, { now: new Date("2026-05-08T12:00:00.000Z"), flushEphemeral: true });

    expect(result.flushedEphemeralItems).toBe(1);
    expect(db.activities.getById(canonicalActivity.id)).toMatchObject({ id: canonicalActivity.id });
    expect(db.knowledge.list(EPHEMERAL_MEMORY_COLLECTION)).toHaveLength(0);
    expect(db.knowledge.list(CORE_KNOWLEDGE_COLLECTION)).toHaveLength(1);
  });
});
