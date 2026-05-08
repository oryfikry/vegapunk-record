import type { Database } from "bun:sqlite";
import { nowIso, type NamedSqliteBindings } from "./repositories/shared";

const seedAgents = [
  { id: "stella", name: "Stella", role: "server", status: "active" },
  { id: "lilith", name: "Lilith", role: "satellite", status: "inactive" },
  { id: "shaka", name: "Shaka", role: "satellite", status: "inactive" },
] as const;

export function seedDatabase(db: Database): void {
  const insertAgent = db.query<unknown, NamedSqliteBindings>(`
    INSERT INTO agents (id, name, role, status, custom_llm, created_at, updated_at)
    VALUES ($id, $name, $role, $status, NULL, $created_at, $updated_at)
    ON CONFLICT(id) DO NOTHING
  `);

  const seed = db.transaction(() => {
    for (const agent of seedAgents) {
      const timestamp = nowIso();
      insertAgent.run({
        $id: agent.id,
        $name: agent.name,
        $role: agent.role,
        $status: agent.status,
        $created_at: timestamp,
        $updated_at: timestamp,
      });
    }
  });

  seed();
}
