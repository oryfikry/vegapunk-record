import { describe, expect, test } from "bun:test";
import { createTemporaryDatabase, createTestApp, jsonRequest } from "./helpers";

describe("auth-token-protected write endpoints", () => {
  test("rejects setup writes when STELLA_AUTH_TOKEN is configured", async () => {
    const originalAuthToken = Bun.env.STELLA_AUTH_TOKEN;
    Bun.env.STELLA_AUTH_TOKEN = "test-token";
    const db = createTemporaryDatabase();
    const app = createTestApp(db);

    const rejected = await app.handle(jsonRequest("/api/setup/provider", "POST", {
      provider: "openai",
      apiKey: "sk-test",
    }));
    const accepted = await app.handle(new Request("http://localhost/api/setup/provider", {
      method: "POST",
      headers: {
        "authorization": "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ provider: "openai", apiKey: "sk-test" }),
    }));

    expect(rejected.status).toBe(401);
    expect(await rejected.json()).toEqual({ error: "Unauthorized", status: 401 });
    expect(accepted.status).toBe(200);
    expect(db.configs.get("LLM_PROVIDER")?.value).toBe("openai");
    Bun.env.STELLA_AUTH_TOKEN = originalAuthToken;
  });

  test("accepts x-stella-auth-token for config writes", async () => {
    const originalAuthToken = Bun.env.STELLA_AUTH_TOKEN;
    Bun.env.STELLA_AUTH_TOKEN = "test-token";
    const db = createTemporaryDatabase();
    db.configs.set({ key: "LLM_PROVIDER", value: "mock", type: "string" });
    const app = createTestApp(db);

    const response = await app.handle(new Request("http://localhost/api/config", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-stella-auth-token": "test-token",
      },
      body: JSON.stringify({ LLM_PROVIDER: "ollama" }),
    }));

    expect(response.status).toBe(200);
    expect(db.configs.get("LLM_PROVIDER")?.value).toBe("ollama");
    Bun.env.STELLA_AUTH_TOKEN = originalAuthToken;
  });
});
