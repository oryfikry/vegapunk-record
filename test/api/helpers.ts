import { afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig } from "../../src/config";
import { createDatabase, type VegapunkDatabase } from "../../src/db";
import { createApp } from "../../src/server/app";

const cleanupPaths: string[] = [];
const openDatabases: VegapunkDatabase[] = [];

export function createTemporaryDatabase(): VegapunkDatabase {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-api-"));
  cleanupPaths.push(directory);
  const db = createDatabase(join(directory, "test.sqlite"));
  openDatabases.push(db);
  return db;
}

export function createTestApp(db = createTemporaryDatabase()) {
  return createApp({ db, config: defaultConfig });
}

export function jsonRequest(path: string, method: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new Request(`http://localhost${path}`, init);
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
