import { describe, expect, test } from "bun:test";
import { defaultConfig } from "../../src/config";
import { createTemporaryDatabase, createTestApp, jsonRequest } from "./helpers";

describe("onboarding API", () => {
  test("reports auth token and setup status", async () => {
    const originalAuthToken = Bun.env.STELLA_AUTH_TOKEN;
    Bun.env.STELLA_AUTH_TOKEN = "test-token";
    const app = createTestApp();

    const response = await app.handle(new Request("http://localhost/api/auth/status"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ requiresAuthToken: true, isSetup: false });
    Bun.env.STELLA_AUTH_TOKEN = originalAuthToken;
  });

  test("validates auth token without storing it client-side", async () => {
    const originalAuthToken = Bun.env.STELLA_AUTH_TOKEN;
    Bun.env.STELLA_AUTH_TOKEN = "test-token";
    const app = createTestApp();

    const rejected = await app.handle(jsonRequest("/api/auth/verify", "POST", { authToken: "wrong" }));
    const accepted = await app.handle(jsonRequest("/api/auth/verify", "POST", { authToken: "test-token" }));

    expect(rejected.status).toBe(401);
    expect(await rejected.json()).toEqual({ error: "Invalid auth token", status: 401 });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ verified: true });
    Bun.env.STELLA_AUTH_TOKEN = originalAuthToken;
  });

  test("lists setup providers and persists selected provider secrets", async () => {
    const db = createTemporaryDatabase();
    const app = createTestApp(db);

    const providers = await app.handle(new Request("http://localhost/api/setup/providers"));
    const setup = await app.handle(jsonRequest("/api/setup/provider", "POST", {
      provider: "openai",
      apiKey: "sk-test",
    }));
    const config = await app.handle(new Request("http://localhost/api/config"));

    expect(providers.status).toBe(200);
    expect(await providers.json()).toEqual({
      providers: [
        { name: "openai", keyField: "OPENAI_API_KEY", requiresKey: true },
        { name: "openrouter", keyField: "OPENROUTER_API_KEY", requiresKey: true },
        { name: "gemini", keyField: "GEMINI_API_KEY", requiresKey: true },
        { name: "ollama", keyField: "OLLAMA_BASE_URL", requiresKey: false },
        { name: "custom", keyField: "CUSTOM_LLM_API_KEY", requiresKey: true },
      ],
    });
    expect(setup.status).toBe(200);
    expect(await setup.json()).toEqual({ ok: true, provider: "openai", configured: true });
    expect(db.configs.get("LLM_PROVIDER")?.value).toBe("openai");
    expect(db.configs.get("OPENAI_API_KEY")).toMatchObject({ value: "sk-test", is_secret: 1 });
    expect(await config.json()).toEqual({ service: "stella", llmProvider: "openai" });
  });

  test("treats configured environment provider as setup", async () => {
    const db = createTemporaryDatabase();
    const app = createTestApp(db, { ...defaultConfig, llmProvider: "ollama" });

    const response = await app.handle(new Request("http://localhost/api/auth/status"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requiresAuthToken: Boolean(Bun.env.STELLA_AUTH_TOKEN),
      isSetup: true,
    });
  });
});
