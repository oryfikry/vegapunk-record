import { describe, expect, test } from "bun:test";
import { defaultConfig } from "../../src/config";
import { createApp } from "../../src/server/app";
import { createTemporaryDatabase, createTestApp } from "../api/helpers";

describe("static dashboard", () => {
  test("serves the Alpine and Tailwind dashboard at the root route", async () => {
    const app = createTestApp();

    const response = await app.handle(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("Agent Control Panel");
    expect(html).toContain("Stella Interface");
    expect(html).toContain("Knowledge Stream");
    expect(html).toContain("Settings Modal");
    expect(html).toContain("https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js");
    expect(html).toContain("https://cdn.tailwindcss.com");
    expect(html).toContain("Content-Security-Policy");
    expect(html).toContain("x-data=\"stellaDashboard()\"");
    expect(html).toContain("x-init=\"init()\"");
    expect(html).toContain("x-for=\"agent in agents\"");
    expect(html).toContain("/api/stream/activity");
  });

  test("dashboard shell includes empty states for zero-data startup", async () => {
    const db = createTemporaryDatabase();
    db.sqlite.run("DELETE FROM activity_logs");
    db.sqlite.run("DELETE FROM tasks");
    db.sqlite.run("DELETE FROM agents");
    const app = createTestApp(db);

    const response = await app.handle(new Request("http://localhost/"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("No agents are registered yet.");
    expect(html).toContain("No tasks are queued.");
    expect(html).toContain("No activity logs yet.");
    expect(html).toContain("No safe config values are available yet.");
  });

  test("seeded APIs expose lilith and shaka for the dashboard", async () => {
    const app = createTestApp();

    const response = await app.handle(new Request("http://localhost/api/agents"));
    const agents = await response.json() as Array<{ id: string }>;

    expect(response.status).toBe(200);
    expect(agents.map((agent) => agent.id)).toEqual(["lilith", "shaka", "stella"]);
  });

  test("safe config endpoint omits secret-shaped keys", async () => {
    const app = createApp({
      db: createTemporaryDatabase(),
      config: {
        ...defaultConfig,
        host: "127.0.0.9",
        llmProvider: "mock",
      },
    });

    const response = await app.handle(new Request("http://localhost/api/config"));
    const config = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(config).toEqual({ service: "stella", llmProvider: "mock" });
    expect(Object.keys(config).some((key) => /secret|token|password|cookie|authorization|api[_-]?key/i.test(key))).toBe(false);
    expect(config).not.toHaveProperty("sqlitePath");
    expect(config).not.toHaveProperty("chromaHost");
    expect(config).not.toHaveProperty("nodeEnv");
  });
});
