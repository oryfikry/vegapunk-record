import { agentStatuses, assertEnum, nowIso, type AgentStatus, type NamedSqliteBindings, type SqliteDatabase } from "./shared";

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  custom_llm: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateAgentInput = {
  id: string;
  name: string;
  role: string;
  status: AgentStatus | string;
  custom_llm?: string | null;
};

export type UpdateAgentInput = Partial<Omit<CreateAgentInput, "id">>;

export function createAgentsRepository(db: SqliteDatabase) {
  const byId = db.query<Agent, [string]>("SELECT * FROM agents WHERE id = ?");
  const all = db.query<Agent, []>("SELECT * FROM agents ORDER BY id");
  const insert = db.query<Agent, NamedSqliteBindings>(`
    INSERT INTO agents (id, name, role, status, custom_llm, created_at, updated_at)
    VALUES ($id, $name, $role, $status, $custom_llm, $created_at, $updated_at)
    RETURNING *
  `);

  return {
    getById(id: string): Agent | null {
      return byId.get(id);
    },

    list(): Agent[] {
      return all.all();
    },

    create(input: CreateAgentInput): Agent {
      assertEnum(input.status, agentStatuses, "agent status");
      const timestamp = nowIso();
      return insert.get({
        $id: input.id,
        $name: input.name,
        $role: input.role,
        $status: input.status,
        $custom_llm: input.custom_llm ?? null,
        $created_at: timestamp,
        $updated_at: timestamp,
      }) as Agent;
    },

    update(id: string, input: UpdateAgentInput): Agent | null {
      if (input.status !== undefined) {
        assertEnum(input.status, agentStatuses, "agent status");
      }
      const current = byId.get(id);
      if (!current) {
        return null;
      }
      return db.query<Agent, NamedSqliteBindings>(`
        UPDATE agents
        SET name = $name, role = $role, status = $status, custom_llm = $custom_llm, updated_at = $updated_at
        WHERE id = $id
        RETURNING *
      `).get({
        $id: id,
        $name: input.name ?? current.name,
        $role: input.role ?? current.role,
        $status: input.status ?? current.status,
        $custom_llm: input.custom_llm ?? current.custom_llm,
        $updated_at: nowIso(),
      });
    },
  };
}
