import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig, loadConfig } from "../../src/config";
import { createDatabase, type VegapunkDatabase } from "../../src/db";
import { createApp } from "../../src/server/app";

const cleanupPaths: string[] = [];
const openDatabases: VegapunkDatabase[] = [];

function createTemporaryDatabase(): VegapunkDatabase {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-server-"));
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

describe("Stella server health", () => {
  test("returns healthy Stella status without binding a port", async () => {
    const db = createTemporaryDatabase();
    const app = createApp({ db, config: defaultConfig });

    const response = await app.handle(new Request("http://localhost/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "stella" });
  });

  test("loads config with env vars over SQLite over defaults", () => {
    const db = createTemporaryDatabase();
    db.configs.set({ key: "HOST", value: "127.0.0.2", type: "string" });
    db.configs.set({ key: "PORT", value: "4000", type: "number" });
    db.configs.set({ key: "LLM_PROVIDER", value: "ollama", type: "string" });

    const config = loadConfig(db, { PORT: "5000" });

    expect(config.host).toBe("127.0.0.2");
    expect(config.port).toBe(5000);
    expect(config.sqlitePath).toBe(defaultConfig.sqlitePath);
    expect(config.llmProvider).toBe("ollama");
  });

  test("returns JSON errors without stack traces", async () => {
    const db = createTemporaryDatabase();
    const app = createApp({ db, config: { ...defaultConfig, nodeEnv: "production" } }).get("/explode", () => {
      throw new Error("boom with internal stack details");
    });

    const response = await app.handle(new Request("http://localhost/explode"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Internal Server Error", status: 500 });
    expect(JSON.stringify(body)).not.toContain("stack");
  });
});
