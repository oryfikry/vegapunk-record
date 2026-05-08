import type { Database, SQLQueryBindings } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "migrations");

type MigrationRow = {
  name: string;
};

type NamedSqliteBindings = Extract<SQLQueryBindings, Record<string, unknown>>;

export function runMigrations(db: Database, directory = migrationsDirectory): string[] {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(db.query<MigrationRow, []>("SELECT name FROM _migrations").all().map((row) => row.name));
  const migrationFiles = readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const newlyApplied: string[] = [];

  const applyMigration = db.transaction((file: string) => {
    const sql = readFileSync(join(directory, file), "utf8");
    db.exec(sql);
    db.query<unknown, NamedSqliteBindings>(
      "INSERT INTO _migrations (name, applied_at) VALUES ($name, $applied_at)",
    ).run({ $name: file, $applied_at: new Date().toISOString() });
  });

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      continue;
    }
    applyMigration(file);
    newlyApplied.push(file);
  }

  return newlyApplied;
}
