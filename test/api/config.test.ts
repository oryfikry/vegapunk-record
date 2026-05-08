import { describe, expect, test } from "bun:test";
import { createTemporaryDatabase, createTestApp, jsonRequest } from "./helpers";

describe("config API", () => {
  test("PATCH /api/config updates only existing non-secret config keys", async () => {
    const db = createTemporaryDatabase();
    db.configs.set({ key: "LLM_PROVIDER", value: "mock", type: "string" });
    const app = createTestApp(db);

    const response = await app.handle(jsonRequest("/api/config", "PATCH", { LLM_PROVIDER: "ollama" }));
    const body = await response.json() as { ok: boolean; config: Array<{ key: string; value: string; is_secret: number }> };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      config: [expect.objectContaining({ key: "LLM_PROVIDER", value: "ollama", is_secret: 0 })],
    });
    expect(db.configs.get("LLM_PROVIDER")?.value).toBe("ollama");
  });

  test("PATCH /api/config rejects secret config keys without changing them", async () => {
    const db = createTemporaryDatabase();
    db.configs.set({ key: "OPENAI_API_KEY", value: "original-secret", type: "string", is_secret: true });
    const app = createTestApp(db);

    const response = await app.handle(jsonRequest("/api/config", "PATCH", { OPENAI_API_KEY: "new-secret" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Config key is secret and cannot be updated: OPENAI_API_KEY", status: 403 });
    expect(db.configs.get("OPENAI_API_KEY")?.value).toBe("original-secret");
  });
});
