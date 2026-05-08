import { afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type VegapunkDatabase } from "../../src/db";

const cleanupPaths: string[] = [];
const openDatabases: VegapunkDatabase[] = [];

export function createTemporaryDatabase(): VegapunkDatabase {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-chroma-"));
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
