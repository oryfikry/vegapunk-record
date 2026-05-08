import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, type VegapunkDatabase } from "../../src/db";

type JournalModeRow = {
  journal_mode: string;
};

const cleanupPaths: string[] = [];

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "vegapunk-db-"));
  cleanupPaths.push(directory);
  return join(directory, "test.sqlite");
}

afterEach(() => {
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

describe("database connection", () => {
  test("initializes SQLite with WAL mode", () => {
    const db = createDatabase(temporaryDatabasePath());

    try {
      const row = db.sqlite.query<JournalModeRow, []>("PRAGMA journal_mode;").get();

      expect(row?.journal_mode.toLowerCase()).toBe("wal");
    } finally {
      db.close();
    }
  });

  test("runs migrations idempotently and keeps seed data stable", () => {
    const path = temporaryDatabasePath();
    const first = createDatabase(path);
    let second: VegapunkDatabase | null = null;

    try {
      expect(first.appliedMigrations).toContain("001_initial_schema.sql");
      expect(first.agents.list()).toHaveLength(3);
      first.close();

      second = createDatabase(path);
      expect(second.appliedMigrations).toEqual([]);
      expect(second.agents.list()).toHaveLength(3);
    } finally {
      second?.close();
    }
  });
});
