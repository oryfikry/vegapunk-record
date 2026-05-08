import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./migrate";
import {
  createActivitiesRepository,
  createAgentsRepository,
  createConfigsRepository,
  createEmbeddingJobsRepository,
  createKnowledgeRepository,
  createTasksRepository,
} from "./repositories";
import { seedDatabase } from "./seed";

export type VegapunkDatabase = ReturnType<typeof createDatabase>;

function ensureDatabaseDirectory(path: string): void {
  if (path === ":memory:" || path === "") {
    return;
  }

  const directory = dirname(path);
  if (directory === "." || directory === path) {
    return;
  }

  mkdirSync(directory, { recursive: true });
}

export function createDatabase(path: string) {
  ensureDatabaseDirectory(path);
  const sqlite = new Database(path, { create: true });
  sqlite.run("PRAGMA journal_mode = WAL;");
  sqlite.run("PRAGMA foreign_keys = ON;");
  const appliedMigrations = runMigrations(sqlite);
  seedDatabase(sqlite);

  return {
    sqlite,
    appliedMigrations,
    agents: createAgentsRepository(sqlite),
    tasks: createTasksRepository(sqlite),
    configs: createConfigsRepository(sqlite),
    activities: createActivitiesRepository(sqlite),
    knowledge: createKnowledgeRepository(sqlite),
    embeddingJobs: createEmbeddingJobsRepository(sqlite),
    close(): void {
      sqlite.close();
    },
  };
}
