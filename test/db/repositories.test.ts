import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type VegapunkDatabase } from "../../src/db";

const cleanupPaths: string[] = [];
const openDatabases: VegapunkDatabase[] = [];

function createTemporaryDatabase(): VegapunkDatabase {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-repos-"));
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

describe("database repositories", () => {
  test("seeds Stella, Lilith, and Shaka agents", () => {
    const db = createTemporaryDatabase();

    expect(db.agents.getById("stella")).toMatchObject({
      id: "stella",
      name: "Stella",
      role: "server",
      status: "active",
    });
    expect(db.agents.getById("lilith")).toMatchObject({
      id: "lilith",
      name: "Lilith",
      role: "satellite",
      status: "inactive",
    });
    expect(db.agents.getById("shaka")).toMatchObject({
      id: "shaka",
      name: "Shaka",
      role: "satellite",
      status: "inactive",
    });
  });

  test("creates records with generated IDs and ISO timestamps", () => {
    const db = createTemporaryDatabase();

    const task = db.tasks.create({ assigned_to: "stella", status: "pending", description: "Review activity" });
    const activity = db.activities.create({
      agent_id: "stella",
      task_id: task.task_id,
      type: "message",
      level: "info",
      source: "test",
      message: "Repository smoke test",
      metadata: { ok: true },
    });
    const knowledge = db.knowledge.create({
      source_activity_ids: [activity.id],
      collection: "test",
      title: "Test note",
      content: "Knowledge content",
    });
    const embeddingJob = db.embeddingJobs.create({
      knowledge_item_id: knowledge.id,
      collection: "test",
      status: "pending",
    });

    expect(task.task_id).toHaveLength(36);
    expect(activity.id).toHaveLength(36);
    expect(knowledge.id).toHaveLength(36);
    expect(embeddingJob.id).toHaveLength(36);
    expect(Date.parse(task.created_at)).not.toBeNaN();
    expect(Date.parse(activity.timestamp)).not.toBeNaN();
    expect(JSON.parse(activity.metadata_json)).toEqual({ ok: true });
  });

  test("rejects invalid enum values in repository methods", () => {
    const db = createTemporaryDatabase();

    expect(() => db.agents.create({ id: "bad-agent", name: "Bad", role: "test", status: "paused" })).toThrow("Invalid agent status");
    expect(() => db.tasks.create({ status: "paused", description: "Bad task" })).toThrow("Invalid task status");
    expect(() => db.activities.create({ type: "note", level: "info", source: "test", message: "Bad activity type" })).toThrow("Invalid activity type");
    expect(() => db.activities.create({ type: "message", level: "fatal", source: "test", message: "Bad activity level" })).toThrow("Invalid activity level");
    expect(() => db.embeddingJobs.create({ collection: "test", status: "queued" })).toThrow("Invalid embedding job status");
    expect(() => db.embeddingJobs.listByStatus("queued")).toThrow("Invalid embedding job status");
  });
});
