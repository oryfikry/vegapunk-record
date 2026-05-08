import { describe, expect, test } from "bun:test";
import { createTemporaryDatabase, createTestApp, jsonRequest } from "./helpers";

describe("agent API", () => {
  test("registers and upserts agents with active status", async () => {
    const db = createTemporaryDatabase();
    const app = createTestApp(db);

    const createdResponse = await app.handle(jsonRequest("/api/agents/register", "POST", {
      id: "atlas",
      name: "Atlas",
      role: "satellite",
      custom_llm: "ollama",
    }));
    const created = await createdResponse.json();

    expect(createdResponse.status).toBe(201);
    expect(created).toMatchObject({ id: "atlas", name: "Atlas", role: "satellite", status: "active", custom_llm: "ollama" });

    const updatedResponse = await app.handle(jsonRequest("/api/agents/register", "POST", {
      id: "atlas",
      name: "Atlas Prime",
      role: "coordinator",
    }));
    const updated = await updatedResponse.json();

    expect(updatedResponse.status).toBe(201);
    expect(updated).toMatchObject({ id: "atlas", name: "Atlas Prime", role: "coordinator", status: "active", custom_llm: "ollama" });
    expect(db.activities.list().some((activity) => activity.type === "system" && activity.message === "Agent registered: atlas")).toBe(true);
  });

  test("lists agents and supports empty database state", async () => {
    const db = createTemporaryDatabase();
    db.sqlite.run("DELETE FROM agents");
    const app = createTestApp(db);

    const response = await app.handle(new Request("http://localhost/api/agents"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  test("updates agent status with enum validation", async () => {
    const app = createTestApp();

    const response = await app.handle(jsonRequest("/api/agents/lilith/status", "PATCH", { status: "active" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "lilith", status: "active" });

    const invalidResponse = await app.handle(jsonRequest("/api/agents/lilith/status", "PATCH", { status: "paused" }));
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({ status: 400 });
  });

  test("rejects invalid agent registration payloads", async () => {
    const app = createTestApp();

    const response = await app.handle(jsonRequest("/api/agents/register", "POST", { id: "", name: "Bad", role: "satellite" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "id must be a non-empty string", status: 400 });
  });
});
