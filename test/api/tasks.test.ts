import { describe, expect, test } from "bun:test";
import type { Task } from "../../src/db";
import { createTemporaryDatabase, createTestApp, jsonRequest } from "./helpers";

describe("task API", () => {
  test("creates and lists tasks with pending status", async () => {
    const app = createTestApp();

    const createResponse = await app.handle(jsonRequest("/api/tasks", "POST", {
      assigned_to: "stella",
      description: "Summarize the activity log",
    }));
    const created = await createResponse.json() as Task;

    expect(createResponse.status).toBe(201);
    expect(created).toMatchObject({ assigned_to: "stella", description: "Summarize the activity log", status: "pending" });
    expect(created.task_id).toHaveLength(36);

    const listResponse = await app.handle(new Request("http://localhost/api/tasks"));
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([created]);
  });

  test("supports empty task lists", async () => {
    const db = createTemporaryDatabase();
    const app = createTestApp(db);

    const response = await app.handle(new Request("http://localhost/api/tasks"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("updates task status and returns 404 for unknown tasks", async () => {
    const app = createTestApp();
    const createResponse = await app.handle(jsonRequest("/api/tasks", "POST", {
      assigned_to: "stella",
      description: "Run diagnostics",
    }));
    const created = await createResponse.json() as Task;

    const updateResponse = await app.handle(jsonRequest(`/api/tasks/${created.task_id}/status`, "PATCH", { status: "in_progress" }));

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toMatchObject({ task_id: created.task_id, status: "in_progress" });

    const missingResponse = await app.handle(jsonRequest("/api/tasks/missing-task/status", "PATCH", { status: "completed" }));
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({ error: "Task not found", status: 404 });
  });

  test("rejects invalid task payloads and status values", async () => {
    const app = createTestApp();

    const missingDescription = await app.handle(jsonRequest("/api/tasks", "POST", { assigned_to: "stella", description: "" }));
    expect(missingDescription.status).toBe(400);
    expect(await missingDescription.json()).toMatchObject({ status: 400 });

    const invalidStatus = await app.handle(jsonRequest("/api/tasks/whatever/status", "PATCH", { status: "paused" }));
    expect(invalidStatus.status).toBe(400);
    expect(await invalidStatus.json()).toMatchObject({ status: 400 });
  });
});
