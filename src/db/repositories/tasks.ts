import { assertEnum, createId, nowIso, taskStatuses, type NamedSqliteBindings, type SqliteDatabase, type TaskStatus } from "./shared";

export type Task = {
  task_id: string;
  assigned_to: string | null;
  status: TaskStatus;
  description: string;
  created_at: string;
  updated_at: string;
};

export type CreateTaskInput = {
  task_id?: string;
  assigned_to?: string | null;
  status: TaskStatus | string;
  description: string;
};

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "task_id">>;

export function createTasksRepository(db: SqliteDatabase) {
  return {
    getById(taskId: string): Task | null {
      return db.query<Task, [string]>("SELECT * FROM tasks WHERE task_id = ?").get(taskId);
    },

    list(): Task[] {
      return db.query<Task, []>("SELECT * FROM tasks ORDER BY created_at DESC").all();
    },

    create(input: CreateTaskInput): Task {
      assertEnum(input.status, taskStatuses, "task status");
      const timestamp = nowIso();
      return db.query<Task, NamedSqliteBindings>(`
        INSERT INTO tasks (task_id, assigned_to, status, description, created_at, updated_at)
        VALUES ($task_id, $assigned_to, $status, $description, $created_at, $updated_at)
        RETURNING *
      `).get({
        $task_id: input.task_id ?? createId(),
        $assigned_to: input.assigned_to ?? null,
        $status: input.status,
        $description: input.description,
        $created_at: timestamp,
        $updated_at: timestamp,
      }) as Task;
    },

    update(taskId: string, input: UpdateTaskInput): Task | null {
      if (input.status !== undefined) {
        assertEnum(input.status, taskStatuses, "task status");
      }
      const current = this.getById(taskId);
      if (!current) {
        return null;
      }
      return db.query<Task, NamedSqliteBindings>(`
        UPDATE tasks
        SET assigned_to = $assigned_to, status = $status, description = $description, updated_at = $updated_at
        WHERE task_id = $task_id
        RETURNING *
      `).get({
        $task_id: taskId,
        $assigned_to: input.assigned_to ?? current.assigned_to,
        $status: input.status ?? current.status,
        $description: input.description ?? current.description,
        $updated_at: nowIso(),
      });
    },
  };
}
