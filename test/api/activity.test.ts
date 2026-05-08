import { describe, expect, test } from "bun:test";
import type { ActivityLog, Task } from "../../src/db";
import { createTemporaryDatabase, createTestApp, jsonRequest } from "./helpers";

describe("activity API", () => {
  test("ingests normalized activity and supports filtered queries", async () => {
    const app = createTestApp();
    const taskResponse = await app.handle(jsonRequest("/api/tasks", "POST", {
      assigned_to: "stella",
      description: "Inspect logs",
    }));
    const task = await taskResponse.json() as Task;

    const createResponse = await app.handle(jsonRequest("/api/activity", "POST", {
      agent_id: "stella",
      task_id: task.task_id,
      type: "message",
      message: "Activity captured",
      metadata: { ok: true },
    }));
    const activity = await createResponse.json() as ActivityLog;

    expect(createResponse.status).toBe(201);
    expect(activity).toMatchObject({ agent_id: "stella", task_id: task.task_id, type: "message", level: "info", source: "stella", message: "Activity captured" });
    expect(JSON.parse(activity.metadata_json)).toEqual({ ok: true });

    const filteredResponse = await app.handle(new Request(`http://localhost/api/activity?agent_id=stella&task_id=${task.task_id}&type=message`));
    expect(filteredResponse.status).toBe(200);
    expect(await filteredResponse.json()).toEqual([activity]);
  });

  test("supports empty activity lists", async () => {
    const db = createTemporaryDatabase();
    db.sqlite.run("DELETE FROM activity_logs");
    const app = createTestApp(db);

    const response = await app.handle(new Request("http://localhost/api/activity"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("rejects invalid activity payloads and unknown agents", async () => {
    const app = createTestApp();

    const unknownAgent = await app.handle(jsonRequest("/api/activity", "POST", {
      agent_id: "unknown",
      type: "message",
      message: "No agent",
    }));
    expect(unknownAgent.status).toBe(400);
    expect(await unknownAgent.json()).toEqual({ error: "agent_id does not match a registered agent", status: 400 });

    const invalidType = await app.handle(jsonRequest("/api/activity", "POST", {
      agent_id: "stella",
      type: "note",
      message: "Bad type",
    }));
    expect(invalidType.status).toBe(400);
    expect(await invalidType.json()).toMatchObject({ status: 400 });

    const invalidLevel = await app.handle(jsonRequest("/api/activity", "POST", {
      agent_id: "stella",
      type: "message",
      level: "fatal",
      message: "Bad level",
    }));
    expect(invalidLevel.status).toBe(400);
    expect(await invalidLevel.json()).toMatchObject({ status: 400 });
  });

  test("opens a server-sent events activity stream", async () => {
    const app = createTestApp();

    const response = await app.handle(new Request("http://localhost/api/stream/activity"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await response.body?.cancel();
  });
});
